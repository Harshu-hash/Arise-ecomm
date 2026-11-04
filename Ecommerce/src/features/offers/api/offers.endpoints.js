export const OFFERS_ENDPOINTS = {
  landing: '/promotions',
  detail: promotionId => `/promotions/${encodeURIComponent(promotionId)}`,
  products: promotionId => `/promotions/${encodeURIComponent(promotionId)}/products`,
};
