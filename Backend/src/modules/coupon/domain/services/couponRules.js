import { COUPON_STATE, COUPON_STATUS, DELIVERY_FEE_PAISE } from '../constants/coupon.js';

/**
 * A coupon's status is never stored: it follows its state, dates and usage, so it can never be stale.
 * One Mongo expression is the single source of truth — lists, tab counts and single reads all use it.
 */
export const statusExpr = (now = new Date()) => ({
  $switch: {
    branches: [
      { case: { $eq: ['$state', COUPON_STATE.DRAFT] }, then: COUPON_STATUS.DRAFT },
      { case: { $eq: ['$state', COUPON_STATE.PAUSED] }, then: COUPON_STATUS.PAUSED },
      { case: { $or: [{ $eq: ['$state', COUPON_STATE.ENDED] }, { $lt: ['$endsAt', now] }] }, then: COUPON_STATUS.EXPIRED },
      {
        case: { $or: [{ $gte: ['$totalRedemptions', '$totalLimit'] }, { $gte: ['$budgetUsedPaise', '$budgetPaise'] }] },
        then: COUPON_STATUS.EXHAUSTED,
      },
      { case: { $gt: ['$startsAt', now] }, then: COUPON_STATUS.SCHEDULED },
    ],
    default: COUPON_STATUS.ACTIVE,
  },
});

// Percent of the budget given away, as a Mongo expression so the list can sort by it.
export const burnExpr = {
  $cond: [
    { $gt: ['$budgetPaise', 0] },
    { $min: [100, { $round: [{ $multiply: [{ $divide: ['$budgetUsedPaise', '$budgetPaise'] }, 100] }, 0] }] },
    0,
  ],
};

// Returns field errors for an inconsistent coupon (after merging an edit), or null when it is fine.
export function couponErrors(c, now = new Date()) {
  const errors = {};
  if (c.startsAt >= c.endsAt) errors.endsAt = ['The end must be after the start.'];
  else if (c.endsAt <= now) errors.endsAt = ['The end date is in the past.'];
  if (c.perUserLimit > c.totalLimit) errors.perUserLimit = ['Per-customer limit cannot exceed the total redemptions.'];
  if (c.totalLimit < (c.totalRedemptions ?? 0)) errors.totalLimit = [`Already redeemed ${c.totalRedemptions} times.`];
  if (c.budgetPaise < (c.budgetUsedPaise ?? 0)) errors.budgetPaise = ['Budget is below what has already been given.'];
  if (c.type === 'FLAT' && c.valuePaise > c.budgetPaise) errors.budgetPaise = ['Budget must cover at least one redemption.'];
  if (c.type === 'FLAT' && c.minCartPaise && c.valuePaise > c.minCartPaise) {
    errors.valuePaise = ['The discount cannot exceed the minimum cart value.'];
  }
  if (c.type === 'PERCENT' && c.maxDiscountPaise && c.maxDiscountPaise > c.budgetPaise) {
    errors.maxDiscountPaise = ['Max discount cannot exceed the budget.'];
  }
  return Object.keys(errors).length ? errors : null;
}

function computeDiscount(coupon, basisPaise, items) {
  switch (coupon.type) {
    case 'FLAT':
      return Math.min(coupon.valuePaise, basisPaise);
    case 'PERCENT': {
      const raw = Math.round((basisPaise * coupon.valuePct) / 100);
      return coupon.maxDiscountPaise ? Math.min(raw, coupon.maxDiscountPaise) : raw;
    }
    case 'FREE_DELIVERY':
      return DELIVERY_FEE_PAISE;
    case 'BXGY': {
      // Buy X get Y free: the cheapest eligible units are the free ones.
      const units = items.flatMap((item) => Array(item.qty).fill(item.pricePaise)).sort((a, b) => a - b);
      const free = Math.floor(units.length / (coupon.buyQty + coupon.getQty)) * coupon.getQty;
      return units.slice(0, free).reduce((sum, price) => sum + price, 0);
    }
    default:
      return 0;
  }
}

/**
 * Whether a coupon applies to a cart and what it is worth — the one function the "test against a cart" tool and
 * checkout must share, so a coupon can never test as valid and then be refused for the same cart.
 * @param coupon  a coupon with its derived `status`
 * @param cart    { customer: { id, ordersCount? }, items: [{ productId, pricePaise, qty }], redeemedByCustomer? }
 */
export function evaluateCoupon(coupon, cart, now = new Date()) {
  const reasons = [];
  if (coupon.status !== COUPON_STATUS.ACTIVE) reasons.push(`Coupon is ${coupon.status.toLowerCase()}, not active`);

  if ((cart.redeemedByCustomer ?? 0) >= coupon.perUserLimit) reasons.push('Already used the maximum number of times');
  if (coupon.audience.type === 'NEW' && (cart.customer.ordersCount ?? 0) > 0) reasons.push('Only available on a first order');
  if (coupon.audience.type === 'CUSTOM' && !coupon.audience.customerIds.map(String).includes(cart.customer.id)) {
    reasons.push('Not on the eligible customer list');
  }

  // A seller's coupon discounts only that seller's items; the rest of the cart is untouched.
  const all = cart.items ?? [];
  const items = coupon.sellerId ? all.filter((item) => item.sellerId === coupon.sellerId) : all;
  const cartTotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.qty, 0);
  if (!items.length) reasons.push(all.length ? "No item in the cart is from this coupon's seller" : 'The cart is empty');
  else if (cartTotalPaise < coupon.minCartPaise) {
    reasons.push(`Cart must be at least ₹${(coupon.minCartPaise / 100).toLocaleString('en-IN')}`);
  }

  const remaining = coupon.budgetPaise - coupon.budgetUsedPaise;
  const discountPaise = reasons.length ? 0 : Math.min(computeDiscount(coupon, cartTotalPaise, items), remaining);
  return {
    applicable: reasons.length === 0,
    reasons,
    eligibleItemIds: items.map((item) => item.productId),
    basisPaise: cartTotalPaise,
    discountPaise,
  };
}
