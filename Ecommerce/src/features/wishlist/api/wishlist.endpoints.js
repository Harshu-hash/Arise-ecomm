export const WISHLIST_ENDPOINTS = {
  root: '/wishlist',
  items: '/wishlist/items',
  item: productId => `/wishlist/items/${encodeURIComponent(productId)}`,
  moveToCart: productId => `/wishlist/${encodeURIComponent(productId)}/move-to-cart`,
};
