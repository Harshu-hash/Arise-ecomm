export const PRODUCT_ENDPOINTS = Object.freeze({
  detail: productId => `/products/${encodeURIComponent(productId)}`,
  // The product as seen by a shopper who arrived through a campaign (its deal price, when it still applies).
  campaignDetail: (campaignId, productId) =>
    `/campaigns/${encodeURIComponent(campaignId)}/products/${encodeURIComponent(productId)}`,
});
