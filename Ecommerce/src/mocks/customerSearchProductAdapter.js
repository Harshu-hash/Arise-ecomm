import { AxiosError } from 'axios';
import {
  ASK_AI_SUGGESTIONS,
  PRICE_RANGE_FILTERS,
  PRODUCT_CATALOG,
  RATING_FILTERS,
  SEARCH_SUGGESTIONS,
  SORT_OPTIONS,
  TRENDING_SEARCHES,
} from '@features/search/constants/searchData';
import { PRODUCT_FEED, SUGGESTED_PRODUCTS } from '@features/home/data/homeData';
import { MAIN_SIDEBAR_CATEGORIES } from '@features/category/data/categoriesData';
import { ALL_BRANDS } from '@features/brands/data/brandsData';

const LATENCY_MS = 300;
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const toCardDto = product => ({
  id: product.id,
  name: product.name || product.title,
  brand: product.brand || 'Arise Select',
  category: product.category || 'Featured',
  imageUrl: product.image,
  pricePaise: Math.round(product.price * 100),
  mrpPaise: Math.round((product.mrp || product.price) * 100),
  rating: product.rating ?? 4,
  ratingCount:
    typeof product.ratingCount === 'string'
      ? Number(product.ratingCount.replace(/,/g, ''))
      : (product.ratingCount ?? 0),
  assured: product.assured ?? false,
  deliveryLabel: product.deliveryDate || '3-5 days',
});

const additionalProducts = [...SUGGESTED_PRODUCTS, ...PRODUCT_FEED].map(product => ({
  ...product,
  category: 'Featured',
  deliveryDate: '3-5 days',
}));
const productDetailRecommendations = [
  ['sim1', 'Kuons', 'Dark Indigo Denim Shacket', 1995, 3999],
  ['sim2', 'Beyoung', 'Corduroy Shirt for Men', 915, 2499],
  ['sim3', 'Beyoung', 'Classic Corduroy Shirt', 915, 2499],
  ['s1', 'Beyoung', 'Men Corduroy Shirts', 822, 2499],
  ['s2', 'Basics', 'Casual Shirt', 2499, 2499],
  ['s3', 'Roadster', 'Men Slim Fit Shirt', 749, 1799],
  ['s4', 'HRX', 'Men Casual Shirt', 899, 1999],
].map(([id, brand, name, price, mrp], index) => ({
  id,
  brand,
  name,
  price,
  mrp,
  category: 'Fashion',
  rating: 3.9 + (index % 4) / 10,
  ratingCount: 120 + index * 17,
  assured: true,
  deliveryDate: '3-5 days',
  image: `https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=${
    500 + index
  }&q=80`,
}));
const allProducts = [...PRODUCT_CATALOG, ...additionalProducts, ...productDetailRecommendations];
const cardDtos = allProducts.map(toCardDto);

const productDetailEnvelope = productId => {
  const product = allProducts.find(item => item.id === productId);
  if (!product) return null;
  const card = toCardDto(product);
  return {
    data: {
      ...card,
      images: [
        card.imageUrl,
        'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
      ],
      reviewCount: Math.max(1, Math.round(card.ratingCount / 5)),
      color: 'Default',
      sizes: product.category === 'Fashion' ? ['38', '40', '42', '44', '46'] : ['Standard'],
      deliveryAddressLabel: 'Delivery address - Select at checkout',
      description: `${card.name} by ${card.brand}. Product information is supplied by the seller.`,
      fit: product.category === 'Fashion' ? 'Regular Fit' : 'Standard',
      modelInfo: 'See the size chart and seller specifications before ordering.',
      care: 'Follow the care instructions provided on the product label.',
      productCode: card.id.toUpperCase(),
      manufacturer: `${card.brand} authorized seller`,
      countryOfOrigin: 'India',
      available: true,
    },
  };
};

const suggestionsEnvelope = query => {
  const normalized = String(query || '')
    .trim()
    .toLowerCase();
  const suggestions = SEARCH_SUGGESTIONS.filter(
    item => !normalized || item.text.toLowerCase().includes(normalized),
  ).map(({ image, ...item }) => ({ ...item, imageUrl: image }));
  return { data: { suggestions, trending: TRENDING_SEARCHES, prompts: ASK_AI_SUGGESTIONS } };
};

const discount = product => (product.mrpPaise - product.pricePaise) / product.mrpPaise;
const searchEnvelope = params => {
  const query = String(params?.q || '')
    .trim()
    .toLowerCase();
  const categories = String(params?.categories || '')
    .split(',')
    .filter(Boolean);
  const brands = String(params?.brands || '')
    .split(',')
    .filter(Boolean);
  const categoryName = MAIN_SIDEBAR_CATEGORIES.find(item => item.id === params?.categoryId)?.name;
  const brandName = ALL_BRANDS.find(item => item.id === params?.brandId)?.name;
  const priceRange = PRICE_RANGE_FILTERS.find(item => item.id === params?.priceRangeId);
  const minRating = Number(params?.minRating || 0);

  let items = cardDtos.filter(product => {
    const matchesText =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);
    if (!matchesText) return false;
    if (categoryName && product.category.toLowerCase() !== categoryName.toLowerCase()) return false;
    if (brandName && product.brand.toLowerCase() !== brandName.toLowerCase()) return false;
    if (categories.length && !categories.includes(product.category)) return false;
    if (brands.length && !brands.includes(product.brand)) return false;
    if (priceRange) {
      const price = product.pricePaise / 100;
      if (price < priceRange.min || price >= priceRange.max) return false;
    }
    return product.rating >= minRating;
  });

  const sorters = {
    popularity: (a, b) => b.ratingCount - a.ratingCount,
    price_low: (a, b) => a.pricePaise - b.pricePaise,
    price_high: (a, b) => b.pricePaise - a.pricePaise,
    discount: (a, b) => discount(b) - discount(a),
    rating: (a, b) => b.rating - a.rating,
  };
  if (sorters[params?.sort]) items = [...items].sort(sorters[params.sort]);

  const total = items.length;
  const offset = Number(params?.cursor || 0);
  const limit = Math.min(Number(params?.limit || 12), 24);
  const page = items.slice(offset, offset + limit);
  const nextCursor = offset + limit < total ? String(offset + limit) : null;
  return {
    data: {
      items: page,
      total,
      nextCursor,
      facets: {
        categories: [...new Set(cardDtos.map(item => item.category))].sort(),
        brands: [...new Set(cardDtos.map(item => item.brand))].sort(),
        priceRanges: PRICE_RANGE_FILTERS.map(range => ({
          id: range.id,
          label: range.label,
          minPaise: range.min * 100,
          maxPaise: Number.isFinite(range.max) ? range.max * 100 : null,
        })),
        ratings: RATING_FILTERS.map(rating => ({
          id: rating.id,
          label: rating.label,
          value: rating.value,
        })),
      },
      sortOptions: SORT_OPTIONS,
    },
  };
};

export const customerSearchProductFixtureAdapter = async config => {
  await wait();
  if (config.url === '/search/suggestions' && config.method === 'get') {
    return response(config, suggestionsEnvelope(config.params?.q));
  }
  if (config.url === '/search' && config.method === 'get') {
    return response(config, searchEnvelope(config.params));
  }
  if (config.url?.startsWith('/products/') && config.method === 'get') {
    const productId = decodeURIComponent(config.url.slice('/products/'.length));
    const envelope = productDetailEnvelope(productId);
    if (!envelope) return reject(config, 404, 'PRODUCT_NOT_FOUND', 'This product is unavailable.');
    return response(config, envelope);
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export { productDetailEnvelope as createProductDetailFixtureEnvelope };
export { searchEnvelope as createSearchFixtureEnvelope };
export { suggestionsEnvelope as createSuggestionsFixtureEnvelope };
export const getProductCardFixture = productId =>
  cardDtos.find(item => item.id === productId) ?? null;
