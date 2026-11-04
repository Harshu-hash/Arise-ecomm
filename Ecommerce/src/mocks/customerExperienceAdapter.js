import { AxiosError } from 'axios';
import { BRAND_TABS, PRODUCT_FEED, RECENTLY_VIEWED } from '@features/home/data/homeData';
import { FLASH_SALE_PRODUCTS } from '@features/flashSale/data/flashSaleData';
import { DEAL_CATEGORY_PRODUCTS } from '@features/offers/data/dealCategoryProducts';

const LATENCY_MS = 180;
const startsAt = '2026-11-01T00:00:00.000Z';
const endsAt = '2027-01-01T00:00:00.000Z';
let recentlyViewed = RECENTLY_VIEWED.map((item, index) => ({
  id: item.id,
  productId: PRODUCT_FEED[index]?.id || `pf${index + 1}`,
  imageUrl: item.image,
  title: item.title,
  subtitle: item.subtitle,
  viewedAt: new Date(Date.parse('2026-11-03T12:00:00.000Z') - index * 60000).toISOString(),
}));
let adPreferences = {
  personalizedAds: true,
  thirdPartyDataSharing: false,
  locationBasedAds: false,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const promotionSeeds = [
  {
    id: 'everyday-essentials',
    productKey: 'rakhiEssentials',
    title: 'Everyday Essentials',
    subtitle: 'Useful picks at marketplace prices',
    tag: 'VALUE PICKS',
    accent: '#F5443A',
    variant: 'gradient',
  },
  {
    id: 'gifting-favourites',
    productKey: 'rakhiGifting',
    title: 'Gifting Favourites',
    subtitle: 'Thoughtful gifts for every occasion',
    tag: 'GIFT WORTHY',
    accent: '#F5443A',
    variant: 'gradient',
  },
  {
    id: 'flash-hour-deals',
    productKey: 'flashHourDeals',
    title: 'Flash Hour Deals',
    subtitle: 'Limited-time offers while stock lasts',
    tag: 'FLASH DEAL',
    accent: '#CC0C39',
    variant: 'gradient',
  },
  {
    id: 'grocery-savers',
    productKey: 'grocery',
    title: 'Grocery Savers',
    subtitle: 'Everyday essentials at great prices',
    tag: 'DAILY SAVER',
    accent: '#CC0C39',
    variant: 'solid',
  },
];

const toPromotionProduct = item => ({
  id: item.id,
  name: item.name || item.title,
  imageUrl: item.image,
  pricePaise: Math.round(item.price * 100),
  mrpPaise: Math.round(item.mrp * 100),
  rating: item.rating ?? null,
  ratingCount: Number(String(item.ratingCount || '0').replace(/,/g, '')),
});
const promotionProducts = seed =>
  (DEAL_CATEGORY_PRODUCTS[seed.productKey] || []).map(toPromotionProduct);
const promotion = seed => ({
  id: seed.id,
  title: seed.title,
  subtitle: seed.subtitle,
  tag: seed.tag,
  accent: seed.accent,
  variant: seed.variant,
  startsAt,
  endsAt,
  couponCode: seed.id === 'flash-hour-deals' ? 'ARISE10' : null,
  couponHint: seed.id === 'flash-hour-deals' ? 'Eligibility is confirmed in cart.' : null,
  items: promotionProducts(seed).slice(0, 3).map(item => ({
    id: `tile-${item.id}`,
    productId: item.id,
    imageUrl: item.imageUrl,
    label: item.name,
    bannerText: `From ₹${Math.round(item.pricePaise / 100)}`,
  })),
});

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
    response(config, { error: { code, message, retryable: false } }, status),
  );
};

export const resetCustomerExperienceFixture = () => {
  recentlyViewed = RECENTLY_VIEWED.map((item, index) => ({
    id: item.id,
    productId: PRODUCT_FEED[index]?.id || `pf${index + 1}`,
    imageUrl: item.image,
    title: item.title,
    subtitle: item.subtitle,
    viewedAt: new Date(Date.parse('2026-11-03T12:00:00.000Z') - index * 60000).toISOString(),
  }));
  adPreferences = {
    personalizedAds: true,
    thirdPartyDataSharing: false,
    locationBasedAds: false,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
};

export const customerExperienceFixtureAdapter = async config => {
  await wait();
  if (config.url === '/health' && config.method === 'get') {
    return response(config, { data: { status: 'ok', checkedAt: new Date().toISOString() } });
  }
  if (config.url === '/coupons/available' && config.method === 'get') {
    return response(config, {
      data: {
        items: [
          {
            id: 'coupon-welcome',
            code: 'WELCOME50',
            title: 'Flat ₹50 off',
            description: 'On the first eligible order above ₹199',
            expiresAt: '2026-12-31T18:29:59.000Z',
            eligibilityStatus: 'UNKNOWN',
          },
          {
            id: 'coupon-grocery',
            code: 'FRESH20',
            title: '20% off eligible grocery',
            description: 'Final eligibility and maximum discount are confirmed in cart',
            expiresAt: '2026-12-15T18:29:59.000Z',
            eligibilityStatus: 'UNKNOWN',
          },
        ],
      },
    });
  }
  if (config.url === '/me/ad-preferences' && config.method === 'get') {
    return response(config, { data: adPreferences });
  }
  if (config.url === '/me/ad-preferences' && config.method === 'patch') {
    adPreferences = {
      ...adPreferences,
      ...config.data,
      updatedAt: new Date().toISOString(),
    };
    return response(config, { data: adPreferences });
  }
  if (config.url === '/promotions' && config.method === 'get') {
    return response(config, {
      data: {
        brandTabs: BRAND_TABS.map(({ iconImage, badgeIcon, ...tab }) => tab),
        items: promotionSeeds.map(promotion),
      },
    });
  }
  const promotionMatch = config.url?.match(/^\/promotions\/([^/]+)(\/products)?$/);
  if (promotionMatch && config.method === 'get') {
    const seed = promotionSeeds.find(item => item.id === decodeURIComponent(promotionMatch[1]));
    if (!seed) return reject(config, 404, 'PROMOTION_NOT_FOUND', 'Promotion was not found.');
    const products = promotionProducts(seed);
    if (promotionMatch[2]) {
      const sort = config.params?.sort;
      if (sort === 'priceLow') products.sort((a, b) => a.pricePaise - b.pricePaise);
      if (sort === 'priceHigh') products.sort((a, b) => b.pricePaise - a.pricePaise);
      if (sort === 'discount')
        products.sort(
          (a, b) =>
            (b.mrpPaise - b.pricePaise) / b.mrpPaise -
            (a.mrpPaise - a.pricePaise) / a.mrpPaise,
        );
      return response(config, { data: { items: products, nextCursor: null } });
    }
    return response(config, {
      data: { ...promotion(seed), relatedProducts: PRODUCT_FEED.slice(0, 6).map(toPromotionProduct) },
    });
  }
  if (config.url === '/flash-sales/current' && config.method === 'get') {
    return response(config, {
      data: {
        id: 'flash-current',
        title: 'Flash Sale',
        startsAt,
        endsAt,
        items: FLASH_SALE_PRODUCTS.map(item => ({
          id: item.id,
          productId: item.id,
          brand: item.brand,
          name: item.title,
          imageUrl: item.image,
          pricePaise: Math.round(item.price * 100),
          mrpPaise: Math.round(item.mrp * 100),
          discountPct: item.discountPct,
        })),
      },
    });
  }
  if (config.url === '/me/recently-viewed' && config.method === 'get') {
    return response(config, { data: { items: recentlyViewed } });
  }
  if (config.url === '/me/recently-viewed' && config.method === 'delete') {
    recentlyViewed = [];
    return response(config, { data: { cleared: true } });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No experience fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
