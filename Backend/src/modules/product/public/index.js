export {
  deleteCustomerProductHistory,
  getCatalogHighlights,
  getLiveProductCards,
  getPurchasableOffers,
  listHomeProductFeed,
  listHomeSections,
  findVariantIdByLabel,
  getVariantShippingSpecs,
  pickOfferId,
  suggestFromCatalog,
} from '../application/customerCatalog.service.js';
export { listLiveProductOptions, listSellerCampaignProducts } from '../application/listing.service.js';
export { findLiveProducts, getQuestionableProduct, getSellerProductIds, getShelfPrices } from '../application/marketingLookup.service.js';
export {
  commitStock,
  expireStaleReservations,
  holdStock,
  releaseStock,
  returnStock,
} from '../application/stockReservation.service.js';

// Read access for the analytics module (it aggregates; it never writes these).
export { Offer } from '../infrastructure/persistence/offer.model.js';
export { Product } from '../infrastructure/persistence/product.model.js';
