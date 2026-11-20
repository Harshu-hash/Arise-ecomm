export const COUPON_TYPES = ['FLAT', 'PERCENT', 'FREE_DELIVERY', 'BXGY'];
export const COUPON_FUNDERS = ['ARISE', 'SELLER', 'CO_FUNDED'];
export const AUDIENCE_TYPES = ['ALL', 'NEW', 'CUSTOM'];
export const COUPON_VISIBILITY = ['PUBLIC', 'HIDDEN'];

// What an admin sets. Everything else shown in the console is derived (see couponRules.statusExpr).
export const COUPON_STATE = Object.freeze({ DRAFT: 'DRAFT', LIVE: 'LIVE', PAUSED: 'PAUSED', ENDED: 'ENDED' });
export const COUPON_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  EXHAUSTED: 'EXHAUSTED',
});

// Sellers fund their own coupons: no buy-x-get-y, and no platform budget cap (redemptions limit them instead).
export const SELLER_COUPON_TYPES = ['PERCENT', 'FLAT', 'FREE_DELIVERY'];
export const SELLER_COUPON_BUDGET_PAISE = 1_000_000_000_00; // effectively uncapped: limited by redemptions instead

export const MAX_COUPON_DAYS = 366;
export const MAX_CUSTOM_AUDIENCE = 500;
// A free-delivery coupon waives the delivery fee; there is no shipping module yet, so this is the platform's flat fee.
export const DELIVERY_FEE_PAISE = 4000;

export const DEAL_PLACEMENTS = ['TOP_VALUE_DEALS', 'OFFERS_PAGE'];
export const DEAL_TAGS = ['BESTSELLER', 'TRENDING', 'SUPER SAVER', 'HOT DEAL'];
export const DEAL_STATUS = Object.freeze({ SCHEDULED: 'SCHEDULED', ACTIVE: 'ACTIVE', ENDED: 'ENDED' });
export const MAX_DEAL_DAYS = 90;
