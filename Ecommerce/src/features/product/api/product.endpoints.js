export const PRODUCT_ENDPOINTS = Object.freeze({
  detail: productId => `/products/${encodeURIComponent(productId)}`,
  // "Similar Products" and "Products you may like" for one product page.
  related: productId => `/products/${encodeURIComponent(productId)}/related`,
  // The product as seen by a shopper who arrived through a campaign (its deal price, when it still applies).
  campaignDetail: (campaignId, productId) =>
    `/campaigns/${encodeURIComponent(campaignId)}/products/${encodeURIComponent(productId)}`,
});
