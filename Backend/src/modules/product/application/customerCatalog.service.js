import { NotFoundError } from '../../../shared/errors/AppError.js';
import { attributeSetDetails } from '../../attribute/public/index.js';
import { getBrandImages, getSizeChartForDisplay } from '../../catalog/public/index.js';
import { getCategoryForListing, visibleCategoryIds } from '../../category/public/index.js';
import { dealPriceForVariant, getCampaignDealPrices } from '../../coupon/public/index.js';
import { getUnsellableSellerIds } from '../../identity/public/index.js';
import { urlForKey } from '../../media/public/index.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { onCatalogChange } from '../../../infrastructure/realtime/catalogEvents.js';
import { ttlMemo } from '../../../shared/utils/ttlMemo.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { RecentView } from '../infrastructure/persistence/recentView.model.js';
import { Variant } from '../infrastructure/persistence/variant.model.js';
import { availableUnits } from '../domain/services/stockRules.js';

// Customer read model. A product is shown only once an admin approved it (Product LIVE),
// it has at least one LIVE offer, an image, and its category is visible to customers.

// shortcut: candidates are sorted/filtered/paged in memory, capped here; move to an aggregation once live products pass a few thousand.
const MAX_CANDIDATES = 2000;

export const PRICE_RANGES = [
  { id: 'p1', label: 'Under ₹500', minPaise: 0, maxPaise: 50_000 },
  { id: 'p2', label: '₹500 - ₹2,000', minPaise: 50_000, maxPaise: 200_000 },
  { id: 'p3', label: '₹2,000 - ₹10,000', minPaise: 200_000, maxPaise: 1_000_000 },
  { id: 'p4', label: 'Above ₹10,000', minPaise: 1_000_000, maxPaise: null },
];
const RATING_FILTERS = [
  { id: '4', label: '4★ & above', value: 4 },
  { id: '3', label: '3★ & above', value: 3 },
  { id: '2', label: '2★ & above', value: 2 },
];
export const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'price_low', label: 'Price -- Low to High' },
  { id: 'price_high', label: 'Price -- High to Low' },
  { id: 'discount', label: 'Discount' },
  { id: 'rating', label: 'Rating' },
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const leafName = (path) => (path ?? '').split(' › ').pop();

/** The shopper-facing price: cheapest LIVE offer, preferring ones that are in stock. */
export function bestOffer(offers) {
  const inStock = offers.filter((offer) => availableUnits(offer) > 0);
  return (inStock.length ? inStock : offers).reduce((best, offer) => (offer.sellingPricePaise < best.sellingPricePaise ? offer : best));
}

/**
 * Offers priced as the shopper will actually pay: a running campaign's deal price replaces the shelf price when lower
 * (the same rule the cart uses), and the offer carries `campaign` { name, extraOffPct } so the app can say why.
 * Note: coupon <-> product import each other; fine because both only call across at request time.
 */
export async function withCampaignPrices(offers) {
  const deals = await getCampaignDealPrices(offers.map(({ sellerId, productId }) => ({ sellerId, productId })));
  if (!deals.size) return offers;
  return offers.map((offer) => {
    const deal = deals.get(`${offer.sellerId}:${offer.productId}`);
    const dealPricePaise = deal && dealPriceForVariant(deal, offer.mrpPaise);
    if (!deal || dealPricePaise >= offer.sellingPricePaise) return offer;
    const extraOffPct = Math.round(((offer.sellingPricePaise - dealPricePaise) / offer.sellingPricePaise) * 100);
    return { ...offer, sellingPricePaise: dealPricePaise, campaign: { name: deal.campaignName, extraOffPct, pricePaise: dealPricePaise } };
  });
}

/** Offer id -> the campaign it is currently priced by, for the admin and seller screens (which keep showing the shelf price). */
export async function campaignByOffer(offers) {
  const priced = await withCampaignPrices(offers);
  return new Map(priced.filter((offer) => offer.campaign).map((offer) => [String(offer._id), offer.campaign]));
}

function toCard(product, offers) {
  const best = bestOffer(offers);
  return {
    campaign: best.campaign ?? null,
    id: String(product._id),
    name: product.title,
    brand: product.brandName ?? '',
    brandId: product.brandId ? String(product.brandId) : null,
    category: leafName(product.categoryPath),
    imageUrl: urlForKey(product.images[0], 'PRODUCT_IMAGE'),
    pricePaise: best.sellingPricePaise,
    mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise, 1),
    // No reviews module yet: honest "unrated" instead of an invented score.
    rating: null,
    ratingCount: 0,
    assured: offers.some((offer) => offer.ariseAssured),
    inStock: offers.some((offer) => availableUnits(offer) > 0),
  };
}

async function liveCards(filter) {
  const products = await Product.find({ ...filter, status: 'LIVE', 'images.0': { $exists: true } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(MAX_CANDIDATES)
    .lean();
  // Offers of sellers who may not sell right now (suspended, on holiday, ...) are not on the shelf; a product left with none disappears.
  const offers = await withCampaignPrices(await Offer.find({ productId: { $in: products.map((p) => p._id) }, status: 'LIVE', sellerId: { $nin: await getUnsellableSellerIds() } }).lean());
  const byProduct = new Map();
  for (const offer of offers) {
    const key = String(offer.productId);
    byProduct.set(key, [...(byProduct.get(key) ?? []), offer]);
  }
  return products.flatMap((product) => {
    const own = byProduct.get(String(product._id));
    return own ? [toCard(product, own)] : [];
  });
}

const discount = (card) => (card.mrpPaise - card.pricePaise) / card.mrpPaise;
const SORTERS = {
  price_low: (a, b) => a.pricePaise - b.pricePaise,
  price_high: (a, b) => b.pricePaise - a.pricePaise,
  discount: (a, b) => discount(b) - discount(a),
};

export async function searchCustomerProducts({ q, categoryId, brandId, categories, brands, priceRangeId, minRating, sort, cursor, limit }) {
  const visible = await visibleCategoryIds(categoryId ?? null);
  const facets = { categories: [], brands: [], priceRanges: PRICE_RANGES, ratings: RATING_FILTERS };
  if (!visible) return { items: [], total: 0, nextCursor: null, facets, sortOptions: SORT_OPTIONS };

  const filter = { categoryId: { $in: visible }, ...(brandId ? { brandId } : {}) };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { brandName: pattern }, { categoryPath: pattern }];
  }
  const matched = await liveCards(filter);

  const range = PRICE_RANGES.find((item) => item.id === priceRangeId);
  let items = matched.filter((card) => (
    (!categories.length || categories.includes(card.category))
    && (!brands.length || brands.includes(card.brand))
    && (!range || (card.pricePaise >= range.minPaise && (range.maxPaise === null || card.pricePaise < range.maxPaise)))
    && (card.rating ?? 0) >= minRating
  ));
  if (SORTERS[sort]) items = [...items].sort(SORTERS[sort]);

  const distinct = (key) => [...new Set(matched.map((card) => card[key]).filter(Boolean))].sort();
  return {
    items: items.slice(cursor, cursor + limit),
    total: items.length,
    nextCursor: cursor + limit < items.length ? String(cursor + limit) : null,
    facets: { ...facets, categories: distinct('category'), brands: distinct('brand') },
    sortOptions: SORT_OPTIONS,
  };
}

/** Newest approved products for the home feed card grid. */
export async function listHomeProductFeed({ categoryId = null, limit = 20 } = {}) {
  const visible = await visibleCategoryIds(categoryId);
  if (!visible) return [];
  const cards = await liveCards({ categoryId: { $in: visible } });
  return cards.slice(0, limit).map((card) => ({
    id: card.id,
    brand: card.brand,
    name: card.name,
    imageUrl: card.imageUrl,
    pricePaise: card.pricePaise,
    mrpPaise: card.mrpPaise,
    rating: null,
    ratingCount: null,
  }));
}

const attributeValues = (variants, pattern) => [...new Set(
  variants.flatMap((variant) => Object.entries(variant.attributes ?? {})
    .filter(([code]) => pattern.test(code))
    .map(([, value]) => String(value))),
)];

const toText = (value) => (Array.isArray(value) ? value.join(', ') : String(value));

export async function getCustomerProduct(productId) {
  const notFound = () => new NotFoundError('Product not found.');
  const product = await Product.findOne({ _id: productId, status: 'LIVE' }).lean();
  if (!product) throw notFound();
  if (!(await visibleCategoryIds()).includes(String(product.categoryId))) throw notFound();
  const [offers, variants, category, sizeChart] = await Promise.all([
    Offer.find({ productId: product._id, status: 'LIVE', sellerId: { $nin: await getUnsellableSellerIds() } }).lean().then(withCampaignPrices),
    Variant.find({ productId: product._id }).lean(),
    getCategoryForListing(product.categoryId),
    getSizeChartForDisplay(product.sizeChartId),
  ]);
  if (!offers.length) throw notFound();
  const { attributes: definitions } = await attributeSetDetails(category?.attributeSetId ?? null);
  const nameByCode = new Map(definitions.map((definition) => [definition.code, definition.name]));

  const keys = product.images.length ? product.images : variants.flatMap((variant) => variant.images);
  if (!keys.length) throw notFound();

  const specifications = [
    ...Object.entries(product.attributes ?? {})
      .filter(([, value]) => value !== null && value !== '' && !(Array.isArray(value) && !value.length))
      .map(([code, value]) => ({ label: nameByCode.get(code) ?? code, value: toText(value) })),
    // Seller highlights are written as "Label: value".
    ...product.highlights.flatMap((line) => {
      const [label, ...rest] = line.split(': ');
      return rest.length ? [{ label, value: rest.join(': ') }] : [];
    }),
  ];

  // Each sellable variant carries its own price/stock/images; variants with no live offer are not sellable.
  const offersByVariant = new Map();
  for (const offer of offers) {
    const key = String(offer.variantId);
    offersByVariant.set(key, [...(offersByVariant.get(key) ?? []), offer]);
  }
  const sellable = variants.flatMap((variant) => {
    const own = offersByVariant.get(String(variant._id));
    if (!own) return [];
    const best = bestOffer(own);
    return [{
      id: String(variant._id),
      label: variant.label,
      color: attributeValues([variant], /colou?r/i)[0] ?? null,
      size: attributeValues([variant], /size/i)[0] ?? null,
      pricePaise: best.sellingPricePaise,
      mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise, 1),
      campaign: best.campaign ?? null,
      stock: own.reduce((total, offer) => total + availableUnits(offer), 0),
      images: variant.images.map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
    }];
  });

  return {
    ...toCard({ ...product, images: keys }, offers),
    images: keys.map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
    reviewCount: 0,
    color: sellable.find((variant) => variant.color)?.color ?? '',
    sizes: [...new Set(sellable.map((v) => v.size).filter(Boolean))],
    variants: sellable,
    description: product.description || null,
    fit: product.fit,
    modelInfo: product.modelInfo,
    care: product.care,
    productCode: product.productCode,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.countryOfOrigin,
    available: offers.some((offer) => availableUnits(offer) > 0),
    sizeChart,
    specifications,
  };
}

/* ---------------------------------------------------------------- home page sections */

// Every visible live product as a card, shared by the three home sections below; refreshed every 15s.
const catalogSnapshot = ttlMemo(async () => {
  const visible = await visibleCategoryIds(null);
  return visible ? liveCards({ categoryId: { $in: visible } }) : [];
}, 15_000, () => 'all');
onCatalogChange(catalogSnapshot.clear);

const feedCard = (card) => ({
  id: card.id, brand: card.brand, name: card.name, imageUrl: card.imageUrl,
  pricePaise: card.pricePaise, mrpPaise: card.mrpPaise, rating: null, ratingCount: null,
});
const discountPct = (card) => Math.round(discount(card) * 100);

/** Remembers that a signed-in customer opened a product (best effort; never blocks the product page). */
export async function recordProductView(userId, productId) {
  await RecentView.updateOne({ userId, productId }, { $set: { viewedAt: new Date() } }, { upsert: true });
}

export const deleteCustomerProductHistory = (userId) => RecentView.deleteMany({ userId: String(userId) });

/**
 * "Still looking for these?", "Suggested For You" and "Brands in Spotlight" for the For You page.
 * Recently viewed and the personalised half of suggestions need a signed-in customer; the rest is public.
 */
export async function listHomeSections({ userId = null, suggestedLimit = 10, brandLimit = 3 } = {}) {
  const [cards, views] = await Promise.all([
    catalogSnapshot(),
    userId ? RecentView.find({ userId }).sort({ viewedAt: -1 }).limit(12).lean() : [],
  ]);
  const byId = new Map(cards.map((card) => [card.id, card]));

  const viewed = views.map((view) => byId.get(String(view.productId))).filter(Boolean);
  const recentlyViewed = viewed.slice(0, 10).map((card) => ({
    id: card.id, imageUrl: card.imageUrl, title: card.name, subtitle: card.brand || card.category || 'Product',
  }));

  // Same categories as what they looked at first, then best discounts; things they already saw go last
  // (never dropped), so a small catalogue still fills the rail.
  const viewedIds = new Set(viewed.map((card) => card.id));
  const likedCategories = new Set(viewed.map((card) => card.category));
  const byDiscount = [...cards].sort((a, b) => discount(b) - discount(a));
  const fresh = byDiscount.filter((card) => !viewedIds.has(card.id));
  const suggested = [
    ...fresh.filter((card) => likedCategories.has(card.category)),
    ...fresh.filter((card) => !likedCategories.has(card.category)),
    ...byDiscount.filter((card) => viewedIds.has(card.id)),
  ]
    .slice(0, suggestedLimit)
    .map(feedCard);

  const perBrand = new Map();
  for (const card of cards) {
    if (!card.brandId) continue;
    const entry = perBrand.get(card.brandId) ?? { id: card.brandId, name: card.brand, count: 0, bestPct: 0, image: card.imageUrl };
    entry.count += 1;
    entry.bestPct = Math.max(entry.bestPct, discountPct(card));
    perBrand.set(card.brandId, entry);
  }
  const top = [...perBrand.values()].sort((a, b) => b.count - a.count || b.bestPct - a.bestPct).slice(0, brandLimit);
  const logos = top.length ? await getBrandImages(top.map((brand) => brand.id)) : new Map();
  const brands = top.map((brand) => ({
    id: brand.id,
    name: brand.name,
    imageUrl: deviceUrl(logos.get(brand.id)?.imageUrl) ?? brand.image,
    discount: brand.bestPct >= 1 ? `Up to ${brand.bestPct}% OFF` : 'New arrivals',
    subtitle: `${brand.count} product${brand.count === 1 ? '' : 's'}`,
  }));

  return { recentlyViewed, suggested, brands };
}

/** Customer-visible cards for the given product ids (current snapshot); anything not visible is simply absent. */
export async function getLiveProductCards(productIds) {
  const wanted = new Set(productIds.map(String));
  return new Map((await catalogSnapshot()).filter((card) => wanted.has(card.id)).map((card) => [card.id, card]));
}

/**
 * The offers a shopper could buy right now, by offer id: a LIVE offer of a LIVE product with a photo in a visible category.
 * Offers that fail any of that are simply absent. Always current (not the cached snapshot). Whether the seller may sell
 * is the caller's to check; `sellerId` comes with each offer for that.
 */
export async function getPurchasableOffers(offerIds) {
  const offers = await Offer.find({ _id: { $in: offerIds }, status: 'LIVE' }).lean();
  if (!offers.length) return new Map();
  const [products, variants, visible] = await Promise.all([
    Product.find({ _id: { $in: [...new Set(offers.map((offer) => String(offer.productId)))] }, status: 'LIVE' }, 'title brandName categoryId categoryPath images returnPolicy').lean(),
    Variant.find({ _id: { $in: offers.map((offer) => offer.variantId) } }, 'label images weightG').lean(),
    visibleCategoryIds(),
  ]);
  const visibleSet = new Set(visible);
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const variantById = new Map(variants.map((variant) => [String(variant._id), variant]));
  return new Map(offers.flatMap((offer) => {
    const product = productById.get(String(offer.productId));
    const variant = variantById.get(String(offer.variantId));
    const imageKey = variant?.images?.[0] ?? product?.images?.[0];
    if (!product || !visibleSet.has(String(product.categoryId)) || !imageKey) return [];
    return [[String(offer._id), {
      offerId: String(offer._id),
      productId: String(offer.productId),
      variantId: String(offer.variantId),
      sellerId: offer.sellerId,
      categoryId: String(product.categoryId),
      name: product.title,
      brand: product.brandName ?? '',
      category: leafName(product.categoryPath),
      assured: Boolean(offer.ariseAssured),
      variantLabel: variant?.label || 'Standard',
      weightG: variant?.weightG ?? 500,
      // days after delivery the customer may return it; 0 = not returnable. 7 is the product schema's default for rows older than the field.
      returnWindowDays: product.returnPolicy ? (product.returnPolicy.type === 'RETURN' ? product.returnPolicy.windowDays : 0) : 7, // replacement-only needs replacements, which are not built
      imageUrl: urlForKey(imageKey, 'PRODUCT_IMAGE'),
      pricePaise: offer.sellingPricePaise,
      mrpPaise: Math.max(offer.mrpPaise, offer.sellingPricePaise, 1),
      availableUnits: availableUnits(offer),
    }]];
  }));
}

/** What a courier needs to know about variants: Map(variantId -> { sku, weightG, dimsCm: { l, w, h } }). */
export async function getVariantShippingSpecs(variantIds) {
  const rows = await Variant.find({ _id: { $in: variantIds } }, 'sku weightG dimsCm').lean();
  return new Map(rows.map((row) => [String(row._id), { sku: row.sku, weightG: row.weightG, dimsCm: row.dimsCm }]));
}

/** The variant of a product with this label (the app names variants by label), or null when there is none. */
export async function findVariantIdByLabel(productId, label) {
  return (await Variant.findOne({ productId, label }, '_id').lean())?._id ?? null;
}

/**
 * The offer a shopper gets when they add a product (or one of its variants) without choosing a seller: the cheapest one on
 * sale from a seller who may sell, preferring offers with stock. null when nothing is on sale. The cart still checks the
 * result like any other line, so this only picks; it never promises.
 */
export async function pickOfferId({ productId, variantId = null }) {
  const offers = await Offer.find({
    productId,
    status: 'LIVE',
    ...(variantId ? { variantId } : {}),
    sellerId: { $nin: await getUnsellableSellerIds() },
  }).lean();
  return offers.length ? String(bestOffer(offers)._id) : null;
}
