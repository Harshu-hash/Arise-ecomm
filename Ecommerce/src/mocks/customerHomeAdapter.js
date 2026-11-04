import { AxiosError } from 'axios';
import {
  AD_TILES,
  BRAND_TABS,
  BRANDS_SPOTLIGHT,
  CATEGORY_TABS,
  PRODUCT_FEED,
  RECENTLY_VIEWED,
  SEARCH_PLACEHOLDERS,
  SUGGESTED_PRODUCTS,
  TOP_VALUE_DEALS,
} from '@features/home/data/homeData';

const LATENCY_MS = 350;
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
const imageItem = item => ({ ...item, imageUrl: item.image, image: undefined });
const productItem = item => ({
  id: item.id,
  brand: item.brand || 'Arise Select',
  name: item.name || item.title,
  imageUrl: item.image,
  pricePaise: Math.round(item.price * 100),
  mrpPaise: Math.round(item.mrp * 100),
  rating: item.rating ?? null,
  ratingCount:
    typeof item.ratingCount === 'string'
      ? Number(item.ratingCount.replace(/,/g, ''))
      : (item.ratingCount ?? null),
  badge: item.badge ?? null,
  aspectRatio: item.aspectRatio || 1,
});

const homeEnvelope = () => ({
  data: {
    version: 'fixture-home-v1',
    generatedAt: new Date().toISOString(),
    header: {
      searchPlaceholders: SEARCH_PLACEHOLDERS,
      brandTabs: BRAND_TABS.map(({ iconImage, badgeIcon, ...tab }) => tab),
      categoryTabs: CATEGORY_TABS,
    },
    sections: [
      {
        id: 'hero',
        type: 'HERO',
        status: 'READY',
        items: [
          {
            id: 'hero-1',
            imageUrl:
              'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1400&q=85',
            target: { type: 'OFFERS' },
          },
        ],
      },
      {
        id: 'promos',
        type: 'PROMO_CAROUSEL',
        status: 'READY',
        items: [
          'photo-1441986300917-64674bd600d8',
          'photo-1483985988355-763728e1935b',
          'photo-1523381210434-271e8be1f52b',
        ].map((photo, index) => ({
          id: `promo-${index + 1}`,
          imageUrl: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=80`,
          target: { type: 'OFFERS' },
        })),
      },
      {
        id: 'recently-viewed',
        type: 'RECENTLY_VIEWED',
        status: 'READY',
        items: RECENTLY_VIEWED.map(imageItem),
      },
      { id: 'flash-sale', type: 'FLASH_SALE', status: 'READY', items: [] },
      {
        id: 'ad-tiles',
        type: 'AD_TILES',
        status: 'READY',
        items: AD_TILES.map(imageItem),
      },
      {
        id: 'suggested',
        type: 'SUGGESTED_PRODUCTS',
        status: 'READY',
        items: SUGGESTED_PRODUCTS.map(productItem),
      },
      {
        id: 'brand-spotlight',
        type: 'BRAND_SPOTLIGHT',
        status: 'READY',
        items: BRANDS_SPOTLIGHT.map(imageItem),
      },
      {
        id: 'top-deals',
        type: 'TOP_VALUE_DEALS',
        status: 'READY',
        items: TOP_VALUE_DEALS.map(imageItem),
      },
      {
        id: 'product-feed',
        type: 'PRODUCT_FEED',
        status: 'READY',
        items: PRODUCT_FEED.map(productItem),
      },
    ],
  },
});

export const customerHomeFixtureAdapter = async config => {
  await wait();
  if (config.url === '/home' && config.method === 'get') {
    return response(config, homeEnvelope());
  }
  if (config.url === '/app-config' && config.method === 'get') {
    return response(config, {
      data: {
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.0',
        maintenance: { enabled: false, message: null },
        storeUrls: {
          android: 'market://details?id=com.ariseecommerce',
          ios: 'https://apps.apple.com/app/arise-marketplace/id0000000000',
        },
        featureFlags: {
          wallet: true,
          referrals: true,
          productQuestions: true,
        },
      },
    });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export { homeEnvelope as createHomeFixtureEnvelope };
