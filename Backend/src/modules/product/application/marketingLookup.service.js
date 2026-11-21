import { Offer } from '../infrastructure/persistence/offer.model.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { bestOffer } from './customerCatalog.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** LIVE catalog products for admin pickers (deal form, coupon test cart): by title search or by explicit ids. */
export async function findLiveProducts({ q, ids, limit }) {
  const filter = {
    status: 'LIVE',
    ...(ids?.length ? { _id: { $in: ids } } : {}),
    ...(q ? { title: new RegExp(escapeRegex(q), 'i') } : {}),
  };
  const rows = await Product.find(filter, 'title categoryPath').sort({ title: 1 }).limit(limit).lean();
  return rows.map((row) => ({ id: String(row._id), title: row.title, categoryPath: row.categoryPath ?? '' }));
}

/**
 * What a shopper would pay today for each product: its cheapest in-stock LIVE offer.
 * Products that are not LIVE or have no LIVE offer are simply absent from the map.
 */
export async function getShelfPrices(productIds) {
  if (!productIds.length) return new Map();
  const [products, offers] = await Promise.all([
    Product.find({ _id: { $in: productIds }, status: 'LIVE' }, 'title categoryId brandId').lean(),
    Offer.find({ productId: { $in: productIds }, status: 'LIVE' }).lean(),
  ]);
  const offersByProduct = Map.groupBy(offers, (offer) => String(offer.productId));
  return new Map(
    products.flatMap((product) => {
      const own = offersByProduct.get(String(product._id));
      if (!own) return [];
      const best = bestOffer(own);
      return [[String(product._id), {
        productId: String(product._id),
        title: product.title,
        categoryId: String(product.categoryId),
        brandId: product.brandId ? String(product.brandId) : null,
        sellerId: best.sellerId,
        offerId: String(best._id),
        fulfillmentType: best.fulfillmentType,
        pricePaise: best.sellingPricePaise,
        mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise),
      }]];
    }),
  );
}
