export const PRODUCT_ENDPOINTS = Object.freeze({
  detail: productId => `/products/${encodeURIComponent(productId)}`,
});
