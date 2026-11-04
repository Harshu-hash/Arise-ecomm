export const CART_ENDPOINTS = {
  root: '/cart',
  items: '/cart/items',
  item: cartItemId => `/cart/items/${encodeURIComponent(cartItemId)}`,
  saveForLater: cartItemId => `/cart/items/${encodeURIComponent(cartItemId)}/save-for-later`,
  moveToCart: cartItemId => `/cart/saved/${encodeURIComponent(cartItemId)}/move-to-cart`,
  eligibleCoupons: '/coupons/eligible',
  coupon: '/cart/coupon',
};
