import { NotFoundError } from '../../../shared/errors/AppError.js';
import { attributeSetDetails } from '../../attribute/public/index.js';
import { getBrandImages, getSizeChartForDisplay } from '../../catalog/public/index.js';
import { findCategoryForCatalog, visibleCategoryIds } from '../../category/public/index.js';
import { dealPriceForVariant, getCampaignDealPrices } from '../../coupon/public/index.js';
import { getUnsellableSellerIds } from '../../identity/public/index.js';
import { urlForKey } from '../../media/public/index.js';
import { getRatingSummaries } from '../../review/public/index.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { onCatalogChange } from '../../../infrastructure/realtime/catalogEvents.js';
import { ttlMemo } from '../../../shared/utils/ttlMemo.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { RecentView } from '../infrastructure/persistence/recentView.model.js';
import { Variant } from '../infrastructure/persistence/variant.model.js';
import { availableUnits } from '../domain/services/stockRules.js';
import { cardMatchesLoosely, correctTokens, rankByPopularity, rankByRelevance, tokenize, vocabularyOf, withSynonyms } from '../domain/services/searchRules.js';

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

function toCard(product, offers, summary = null) {
  const best = bestOffer(offers);
  return {
    campaign: best.campaign ?? null,
    id: String(product._id),
    name: product.title,
    brand: product.brandName ?? '',
    brandId: product.brandId ? String(product.brandId) : null,
    category: leafName(product.categoryPath),
    rootCategory: (product.categoryPath ?? '').split(' › ')[0],
    imageUrl: urlForKey(product.images[0], 'PRODUCT_IMAGE'),
    pricePaise: best.sellingPricePaise,
    mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise, 1),
    // Unrated products stay null/0 rather than showing an invented score.
    rating: summary?.rating ?? null,
    ratingCount: summary?.ratingCount ?? 0,
    assured: offers.some((offer) => offer.ariseAssured),
    inStock: offers.some((offer) => availableUnits(offer) > 0),
  };
}

async function liveCards(filter) {
  const [products, unsellableSellerIds] = await Promise.all([
    Product.find({ ...filter, status: 'LIVE', 'images.0': { $exists: true } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_CANDIDATES)
      .lean(),
    getUnsellableSellerIds(),
  ]);
  // Offers of sellers who may not sell right now (suspended, on holiday, ...) are not on the shelf; a product left with none disappears.
  const productIds = products.map((product) => product._id);
  const rawOffers = await Offer.find({ productId: { $in: productIds }, status: 'LIVE', sellerId: { $nin: unsellableSellerIds } }).lean();
  const [offers, ratings] = await Promise.all([
    withCampaignPrices(rawOffers),
    getRatingSummaries(productIds),
  ]);
  const byProduct = new Map();
  for (const offer of offers) {
    const key = String(offer.productId);
    byProduct.set(key, [...(byProduct.get(key) ?? []), offer]);
  }
  return products.flatMap((product) => {
    const own = byProduct.get(String(product._id));
    return own ? [toCard(product, own, ratings.get(String(product._id)))] : [];
  });
}

// Home and recommendation sections ask for the same shelf together; share that in-flight read instead of rebuilding it.
const homeCards = ttlMemo(
  (categoryIds) => liveCards({ categoryId: { $in: categoryIds } }),
  15_000,
  (categoryIds) => categoryIds.join(','),
  { staleWhileRevalidate: true }, // rebuilding the shelf takes seconds; never make a shopper wait for it after the first fill
);
onCatalogChange(homeCards.clear);

const customerAttributeDetails = ttlMemo(
  (attributeSetId) => attributeSetDetails(attributeSetId),
  60_000,
  (attributeSetId) => String(attributeSetId ?? ''),
);
onCatalogChange(customerAttributeDetails.clear);

const discount = (card) => (card.mrpPaise - card.pricePaise) / card.mrpPaise;
const SORTERS = {
  price_low: (a, b) => a.pricePaise - b.pricePaise,
  price_high: (a, b) => b.pricePaise - a.pricePaise,
  discount: (a, b) => discount(b) - discount(a),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.ratingCount - a.ratingCount,
};

export async function searchCustomerProducts({ q, categoryId, brandId, sellerId, categories, brands, priceRangeId, minRating, sort, cursor, limit }) {
  const visible = await visibleCategoryIds(categoryId ?? null);
  const facets = { categories: [], brands: [], priceRanges: PRICE_RANGES, ratings: RATING_FILTERS };
  if (!visible) return { items: [], total: 0, nextCursor: null, facets, sortOptions: SORT_OPTIONS };

  const filter = {
    categoryId: { $in: visible },
    ...(brandId ? { brandId } : {}),
    ...(sellerId ? { _id: { $in: await Offer.distinct('productId', { sellerId, status: 'LIVE' }) } } : {}),
  };
  let tokens = tokenize(q);
  const find = (words) => liveCards({
    ...filter,
    // Every word (or a synonym) must appear in the title, brand, category or description, in any order ("nike shoes" finds "Nike Revolution Running Shoes").
    ...(words.length ? { $and: words.map((word) => {
      const pattern = new RegExp(withSynonyms(word).map(escapeRegex).join('|'), 'i');
      return { $or: [{ title: pattern }, { brandName: pattern }, { categoryPath: pattern }, { description: pattern }] };
    }) } : {}),
  });
  let matched = await find(tokens);
  // Nothing sells under the words as typed: try the nearest spelling on the shelf ("addidas" -> "adidas").
  let correctedQuery = null;
  const fixed = !matched.length && tokens.length ? correctTokens(tokens, vocabularyOf(await catalogSnapshot())) : null;
  if (fixed) {
    matched = await find(fixed);
    if (matched.length) {
      correctedQuery = fixed.join(' ');
      tokens = fixed;
    }
  }

  const range = PRICE_RANGES.find((item) => item.id === priceRangeId);
  let items = matched.filter((card) => (
    (!categories.length || categories.includes(card.category))
    && (!brands.length || brands.includes(card.brand))
    && (!range || (card.pricePaise >= range.minPaise && (range.maxPaise === null || card.pricePaise < range.maxPaise)))
    && (card.rating ?? 0) >= minRating
  ));
  if (SORTERS[sort]) items = [...items].sort(SORTERS[sort]);
  else if (sort === 'popularity') items = rankByPopularity(items, tokens, await salesByProduct());
  else items = rankByRelevance(items, tokens); // "relevance": best name/brand match first, then in-stock, newest

  const distinct = (key) => [...new Set(matched.map((card) => card[key]).filter(Boolean))].sort();
  return {
    items: items.slice(cursor, cursor + limit),
    total: items.length,
    nextCursor: cursor + limit < items.length ? String(cursor + limit) : null,
    facets: { ...facets, categories: distinct('category'), brands: distinct('brand') },
    sortOptions: SORT_OPTIONS,
    correctedQuery,
    // A search that finds nothing offers real places to go instead.
    tryInstead: matched.length ? [] : await getCatalogHighlights(6),
  };
}

/** Newest approved products for the home feed card grid. */
export async function listHomeProductFeed({ categoryId = null, limit = 20, offset = 0 } = {}) {
  const visible = await visibleCategoryIds(categoryId);
  if (!visible) return [];
  const cards = await homeCards(visible);
  return cards.slice(offset, offset + limit).map((card) => ({
    id: card.id,
    brand: card.brand,
    name: card.name,
    imageUrl: card.imageUrl,
    pricePaise: card.pricePaise,
    mrpPaise: card.mrpPaise,
    rating: card.rating,
    ratingCount: card.ratingCount,
  }));
}

const attributeValues = (variants, pattern) => [...new Set(
  variants.flatMap((variant) => Object.entries(variant.attributes ?? {})
    .filter(([code]) => pattern.test(code))
    .map(([, value]) => String(value))),
)];

// What else a customer picks between variants besides colour and size ("8/128" vs "8/256", storage, pack of...): one group per
// variant-defining attribute that has more than one value among the sellable variants, in the order they were listed.
export const variantOptions = (variants, nameByCode) => {
  const values = new Map();
  for (const variant of variants) {
    for (const [code, value] of Object.entries(variant.attributes)) {
      if (/colou?r|size/i.test(code) || !value) continue;
      values.set(code, [...new Set([...(values.get(code) ?? []), value])]);
    }
  }
  return [...values].filter(([, list]) => list.length > 1).map(([code, list]) => ({ code, name: nameByCode.get(code) ?? code, values: list }));
};

const toText = (value) => (Array.isArray(value) ? value.join(', ') : String(value));

export async function getCustomerProduct(productId) {
  const notFound = () => new NotFoundError('Product not found.');
  const [product, visibleCategories] = await Promise.all([
    Product.findOne({ _id: productId, status: 'LIVE' }).lean(),
    visibleCategoryIds(),
  ]);
  if (!product) throw notFound();
  if (!visibleCategories.includes(String(product.categoryId))) throw notFound();
  const offersPromise = getUnsellableSellerIds()
    .then((unsellableSellerIds) => Offer.find({ productId: product._id, status: 'LIVE', sellerId: { $nin: unsellableSellerIds } }).lean())
    .then(withCampaignPrices);
  const categoryPromise = findCategoryForCatalog(product.categoryId);
  const definitionsPromise = categoryPromise.then((category) => customerAttributeDetails(category?.attributeSetId ?? null));
  const [offers, variants, sizeChart, ratings, { attributes: definitions }] = await Promise.all([
    offersPromise,
    Variant.find({ productId: product._id }).lean(),
    getSizeChartForDisplay(product.sizeChartId),
    getRatingSummaries([product._id]),
    definitionsPromise,
  ]);
  if (!offers.length) throw notFound();
  const summary = ratings.get(String(product._id));
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
      attributes: Object.fromEntries(Object.entries(variant.attributes ?? {}).map(([code, value]) => [code, toText(value)])),
      pricePaise: best.sellingPricePaise,
      mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise, 1),
      campaign: best.campaign ?? null,
      stock: own.reduce((total, offer) => total + availableUnits(offer), 0),
      images: variant.images.map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
    }];
  });

  return {
    ...toCard({ ...product, images: keys }, offers, summary),
    images: keys.map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
    reviewCount: summary?.ratingCount ?? 0, // every rating comes with a written review for now
    color: sellable.find((variant) => variant.color)?.color ?? '',
    sizes: [...new Set(sellable.map((v) => v.size).filter(Boolean))],
    options: variantOptions(sellable, nameByCode),
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
  return visible ? homeCards(visible) : [];
}, 15_000, () => 'all', { staleWhileRevalidate: true });
onCatalogChange(catalogSnapshot.clear);

const feedCard = (card) => ({
  id: card.id, brand: card.brand, name: card.name, imageUrl: card.imageUrl,
  pricePaise: card.pricePaise, mrpPaise: card.mrpPaise, rating: card.rating, ratingCount: card.ratingCount,
});
const discountPct = (card) => Math.round(discount(card) * 100);

/**
 * What goes under a product page. Pure, so it is tested without a database.
 * similar: the same shelf (same category), same brand first, then the nearest price.
 * suggested: everything else, the product's own wider category first, then the categories this shopper has been looking at,
 *   then the best discounts; what they already viewed goes last (never dropped, so a small catalogue still fills the rail).
 */
export function relatedFrom(cards, productId, viewedIds = new Set(), { similarLimit = 10, suggestedLimit = 12 } = {}) {
  const self = cards.find((card) => card.id === String(productId));
  if (!self) return { similar: [], suggested: [] };
  const others = cards.filter((card) => card.id !== self.id);
  const gap = (card) => Math.abs(card.pricePaise - self.pricePaise);
  const sameBrand = (card) => (card.brandId && card.brandId === self.brandId ? 1 : 0);
  const similar = others
    .filter((card) => card.rootCategory === self.rootCategory && card.category === self.category)
    .sort((a, b) => sameBrand(b) - sameBrand(a) || gap(a) - gap(b))
    .slice(0, similarLimit);

  const taken = new Set(similar.map((card) => card.id));
  const viewedRoots = new Set(others.filter((card) => viewedIds.has(card.id)).map((card) => card.rootCategory));
  const rank = (card) => (card.rootCategory === self.rootCategory ? 0 : viewedRoots.has(card.rootCategory) ? 1 : 2);
  const rest = others.filter((card) => !taken.has(card.id));
  const byInterest = (a, b) => rank(a) - rank(b) || discount(b) - discount(a);
  const suggested = [
    ...rest.filter((card) => !viewedIds.has(card.id)).sort(byInterest),
    ...rest.filter((card) => viewedIds.has(card.id)).sort(byInterest),
  ].slice(0, suggestedLimit);
  return { similar, suggested };
}

export async function listRelatedProducts(productId, { userId = null } = {}) {
  const [cards, views] = await Promise.all([
    catalogSnapshot(),
    userId ? RecentView.find({ userId }).sort({ viewedAt: -1 }).limit(12).lean() : [],
  ]);
  return relatedFrom(cards, productId, new Set(views.map((view) => String(view.productId))));
}

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

/* ---------------------------------------------------------------- search suggestions and popularity */

const POPULARITY_DAYS = 90;

/** Units sold per product over the last 90 days (Map productId -> units); what the "Popularity" sort ranks by. Refreshed every 10 minutes. */
const salesByProduct = ttlMemo(async () => {
  try {
    // Loaded on demand: order already depends on this module.
    const { Order } = await import('../../order/public/index.js');
    const since = new Date(Date.now() - POPULARITY_DAYS * 86_400_000);
    const rows = await Order.aggregate([
      { $match: { placedAt: { $gte: since } } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.status': { $nin: ['CANCELLED', 'RTO_DELIVERED'] } } },
      { $unwind: '$subOrders.items' },
      { $group: { _id: '$subOrders.items.productId', units: { $sum: '$subOrders.items.quantity' } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), row.units]));
  } catch {
    return new Map(); // a failed read only loses the sales ordering, never the search
  }
}, 10 * 60_000, () => 'all');

const SUGGESTED_PRODUCTS = 5;
const SUGGESTED_BRANDS = 2;
const SUGGESTED_CATEGORIES = 2;
const RELATED_SEARCHES = 3;

const mostCommon = (counts) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
const countBy = (cards, pick) => {
  const counts = new Map();
  for (const card of cards) {
    const key = pick(card);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

/**
 * What to offer while someone types: matching product names (tap to search them), then brands and categories that match
 * a typed word (tap to browse). `related` are searches worth trying next, built from the brands and categories of the
 * matches ("Puma shoe" for "shoe"). Nothing is invented: every entry comes from a product that is on the shelf now.
 */
export async function suggestFromCatalog(q) {
  const tokens = tokenize(q);
  if (!tokens.length) return { suggestions: [], related: [] };
  const matched = rankByRelevance((await catalogSnapshot()).filter((card) => cardMatchesLoosely(card, tokens)), tokens);
  if (!matched.length) return { suggestions: [], related: [] };

  const products = matched.slice(0, SUGGESTED_PRODUCTS).map((card) => ({
    id: `p:${card.id}`, text: card.name, category: card.category || null, type: 'arrow', imageUrl: card.imageUrl,
  }));

  const typedAWordOf = (name) => tokens.some((token) => name.toLowerCase().includes(token));
  const brandIds = mostCommon(countBy(matched.filter((card) => card.brandId && typedAWordOf(card.brand)), (card) => card.brandId)).slice(0, SUGGESTED_BRANDS);
  const logos = brandIds.length ? await getBrandImages(brandIds) : new Map();
  const brands = brandIds.map((brandId) => {
    const card = matched.find((entry) => entry.brandId === brandId);
    return { id: `b:${brandId}`, text: card.brand, category: 'Brand', type: 'chevron', imageUrl: deviceUrl(logos.get(brandId)?.imageUrl) ?? card.imageUrl };
  });

  const categories = mostCommon(countBy(matched.filter((card) => card.category && typedAWordOf(card.category)), (card) => card.category))
    .slice(0, SUGGESTED_CATEGORIES)
    .map((name) => {
      const card = matched.find((entry) => entry.category === name);
      return { id: `c:${name}`, text: name, category: card.rootCategory ? `in ${card.rootCategory}` : null, type: 'chevron', imageUrl: card.imageUrl };
    });

  const typed = tokens.join(' ');
  const related = [
    ...mostCommon(countBy(matched.filter((card) => card.brand && !typedAWordOf(card.brand)), (card) => card.brand)).map((brand) => `${brand} ${typed}`),
    ...mostCommon(countBy(matched.filter((card) => card.category && !typedAWordOf(card.category)), (card) => card.category)).map((category) => `${typed} ${category}`),
  ].slice(0, RELATED_SEARCHES);

  return { suggestions: [...products, ...brands, ...categories], related };
}

/** Names worth showing before anyone has searched: the brands with most products, then the departments. */
export async function getCatalogHighlights(limit = 8) {
  const cards = await catalogSnapshot();
  return [...mostCommon(countBy(cards, (card) => card.brand)), ...mostCommon(countBy(cards, (card) => card.rootCategory))].slice(0, limit);
}

/* ---------------------------------------------------------------- brands and recently viewed */

const BRAND_PAGE = 24;
const POPULAR_BRANDS = 10; // the "Popular" tab is the brands with the most products on the shelf

/**
 * The Brands page: every brand with at least one product on the shelf, filterable by the department it mostly sells in
 * ("Popular" = most products). Brands come from the live snapshot, so a brand with nothing to buy never shows.
 * Returns { filters, items, nextCursor }; `cursor` is an offset.
 */
export async function listCustomerBrands({ filter = 'All', cursor = 0, limit = BRAND_PAGE } = {}) {
  const perBrand = new Map();
  for (const card of await catalogSnapshot()) {
    if (!card.brandId) continue;
    const entry = perBrand.get(card.brandId) ?? { id: card.brandId, name: card.brand, count: 0, bestPct: 0, image: card.imageUrl, departments: new Map() };
    entry.count += 1;
    entry.bestPct = Math.max(entry.bestPct, discountPct(card));
    entry.departments.set(card.rootCategory, (entry.departments.get(card.rootCategory) ?? 0) + 1);
    perBrand.set(card.brandId, entry);
  }
  const brands = [...perBrand.values()];
  const popular = new Set([...brands].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, POPULAR_BRANDS).map((brand) => brand.id));
  const department = (brand) => [...brand.departments].sort((a, b) => b[1] - a[1])[0][0] || 'Other';
  const filters = ['All', ...(popular.size ? ['Popular'] : []), ...[...new Set(brands.map(department))].sort()];

  const matching = brands
    .filter((brand) => filter === 'All' || (filter === 'Popular' ? popular.has(brand.id) : department(brand) === filter))
    .sort((a, b) => a.name.localeCompare(b.name));
  const page = matching.slice(cursor, cursor + limit);
  const logos = page.length ? await getBrandImages(page.map((brand) => brand.id)) : new Map();
  return {
    filters,
    items: page.map((brand) => ({
      id: brand.id,
      name: brand.name,
      imageUrl: deviceUrl(logos.get(brand.id)?.imageUrl) ?? brand.image,
      offerText: brand.bestPct >= 1 ? `Up to ${brand.bestPct}% Off` : null,
      category: department(brand),
      popular: popular.has(brand.id),
    })),
    nextCursor: cursor + limit < matching.length ? String(cursor + limit) : null,
  };
}

const RECENT_LIMIT = 20;

/** The products this customer opened lately, newest first; anything no longer on the shelf is left out. */
export async function listRecentlyViewed(userId) {
  const views = await RecentView.find({ userId: String(userId) }).sort({ viewedAt: -1 }).limit(RECENT_LIMIT * 2).lean();
  const byId = new Map((await catalogSnapshot()).map((card) => [card.id, card]));
  const items = views.flatMap((view) => {
    const card = byId.get(String(view.productId));
    return card ? [{ id: card.id, productId: card.id, imageUrl: card.imageUrl, title: card.name, subtitle: card.brand || card.category || 'Product', viewedAt: view.viewedAt.toISOString() }] : [];
  });
  return { items: items.slice(0, RECENT_LIMIT) };
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
