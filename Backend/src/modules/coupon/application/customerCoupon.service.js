import mongoose from 'mongoose';
import { getSellerSummaries } from '../../identity/public/index.js';
import { COUPON_STATE, COUPON_STATUS } from '../domain/constants/coupon.js';
import { evaluateCoupon, statusExpr } from '../domain/services/couponRules.js';
import { Coupon } from '../infrastructure/persistence/coupon.model.js';
import { getCustomerCouponHistory } from './couponRedemption.service.js';

const MAX_LISTED = 50;
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/** The offer in plain words, e.g. "20% off up to ₹100 on orders above ₹499". */
export function offerSummary(coupon) {
  const offer = {
    FLAT: () => `Flat ${rupees(coupon.valuePaise)} off`,
    PERCENT: () => `${coupon.valuePct}% off${coupon.maxDiscountPaise ? ` up to ${rupees(coupon.maxDiscountPaise)}` : ''}`,
    FREE_DELIVERY: () => 'Free delivery',
    BXGY: () => `Buy ${coupon.buyQty} get ${coupon.getQty} free`,
  }[coupon.type]();
  return `${offer}${coupon.minCartPaise ? ` on orders above ${rupees(coupon.minCartPaise)}` : ''}`;
}

/**
 * Coupons a shopper can use right now: running on their dates, not paused, not used up (the same rules as the ACTIVE
 * status in couponRules.statusExpr), and either public or made for this customer. Hidden public codes stay unlisted.
 * Soonest-ending first. Whether one fits a given cart is only known in the cart, so eligibility is UNKNOWN here.
 */
export async function listAvailableCoupons(customerId = null, now = new Date()) {
  const coupons = await Coupon.find(
    {
      state: COUPON_STATE.LIVE,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      $expr: { $and: [{ $lt: ['$totalRedemptions', '$totalLimit'] }, { $lt: ['$budgetUsedPaise', '$budgetPaise'] }] },
      $or: [
        { visibility: 'PUBLIC', 'audience.type': { $in: ['ALL', 'NEW'] } },
        ...(customerId ? [{ 'audience.type': 'CUSTOM', 'audience.customerIds': customerId }] : []),
      ],
    },
    'code name description type valuePct valuePaise maxDiscountPaise buyQty getQty minCartPaise audience.type sellerId endsAt',
  )
    .sort({ endsAt: 1, _id: 1 })
    .limit(MAX_LISTED)
    .lean();

  const sellers = await getSellerSummaries(coupons.map((coupon) => coupon.sellerId).filter(Boolean));
  return {
    items: coupons.map((coupon) => {
      const conditions = [
        coupon.audience.type === 'NEW' ? 'On your first order' : null,
        coupon.sellerId ? `Only on items from ${sellers.get(coupon.sellerId)?.name ?? 'one seller'}` : null,
      ].filter(Boolean);
      return {
        id: String(coupon._id),
        code: coupon.code,
        title: coupon.name,
        description: [coupon.description || offerSummary(coupon), ...conditions].join(' · '),
        expiresAt: coupon.endsAt,
        eligibilityStatus: 'UNKNOWN',
      };
    }),
  };
}

/**
 * What coupons would do for a cart, by the same rule checkout will use (evaluateCoupon), so a coupon can never look fine
 * in the cart and be refused at payment. `lines` are { productId, sellerId, unitPricePaise, quantity }.
 * With `code`: just that coupon (an unlisted one can still be redeemed by its code); without: every coupon this customer
 * can see, best saving first. Returns { code, type, description, minimumSubtotalPaise, applicable, discountPaise, reasons,
 * belowMinimum } per coupon; an unknown or not-running code returns nothing.
 * The customer's real history (orders placed, times each coupon was used) feeds the first-order and per-customer limits.
 */
export async function evaluateCouponsForCart(customerId, lines, { code = null, now = new Date() } = {}) {
  const customerObjectId = mongoose.Types.ObjectId.isValid(customerId) ? new mongoose.Types.ObjectId(customerId) : null;
  const match = code
    ? { code: String(code).trim().toUpperCase() }
    : { $or: [{ visibility: 'PUBLIC', 'audience.type': { $in: ['ALL', 'NEW'] } }, ...(customerObjectId ? [{ 'audience.type': 'CUSTOM', 'audience.customerIds': customerObjectId }] : [])] };
  // Aggregation, so the running status comes from the one definition the admin console uses.
  const [running, history] = await Promise.all([Coupon.aggregate([
    { $match: { ...match, state: COUPON_STATE.LIVE, endsAt: { $gte: now } } }, // ACTIVE implies both; lets the state/endsAt index narrow the scan
    { $addFields: { status: statusExpr(now) } },
    { $match: { status: COUPON_STATUS.ACTIVE } },
    { $limit: MAX_LISTED },
  ]), getCustomerCouponHistory(customerId)]);
  const cart = {
    customer: { id: String(customerId), ordersCount: history.ordersCount },
    items: lines.map((line) => ({ productId: line.productId, sellerId: line.sellerId, pricePaise: line.unitPricePaise, qty: line.quantity })),
  };
  return running
    .map((coupon) => {
      const result = evaluateCoupon(coupon, { ...cart, redeemedByCustomer: history.redeemed.get(String(coupon._id)) ?? 0 }, now);
      return {
        code: coupon.code,
        type: coupon.type,
        description: coupon.description || offerSummary(coupon),
        minimumSubtotalPaise: coupon.minCartPaise,
        applicable: result.applicable,
        discountPaise: result.discountPaise,
        reasons: result.reasons,
        belowMinimum: coupon.minCartPaise > 0 && result.basisPaise < coupon.minCartPaise,
      };
    })
    .sort((a, b) => b.discountPaise - a.discountPaise);
}
