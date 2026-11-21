import { getSellerSummaries } from '../../identity/public/index.js';
import { COUPON_STATE } from '../domain/constants/coupon.js';
import { Coupon } from '../infrastructure/persistence/coupon.model.js';

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
