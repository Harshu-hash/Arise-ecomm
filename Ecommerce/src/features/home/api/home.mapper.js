import { z } from 'zod';
import {
  appConfigResponseSchema,
  bannerItemSchema,
  brandSpotlightSchema,
  dealCardSchema,
  flashSaleItemSchema,
  homeResponseSchema,
  productCardSchema,
  recentlyViewedItemSchema,
} from './home.schemas';

export const mapAppConfigResponse = payload => appConfigResponseSchema.parse(payload).data;

export const HOME_SECTION_TYPES = Object.freeze({
  hero: 'HERO',
  promoCarousel: 'PROMO_CAROUSEL',
  recentlyViewed: 'RECENTLY_VIEWED',
  flashSale: 'FLASH_SALE',
  suggestedProducts: 'SUGGESTED_PRODUCTS',
  brandSpotlight: 'BRAND_SPOTLIGHT',
  topValueDeals: 'TOP_VALUE_DEALS',
  productFeed: 'PRODUCT_FEED',
});

const parseItems = (section, schema) => z.array(schema).parse(section?.items ?? []);
const moneyToRupees = paise => paise / 100;
const mapBanner = item => ({ id: item.id, image: item.imageUrl, video: item.videoUrl ?? null, target: item.target });
const mapProduct = item => ({
  id: item.id,
  brand: item.brand,
  name: item.name,
  title: item.name,
  image: item.imageUrl,
  price: moneyToRupees(item.pricePaise),
  mrp: moneyToRupees(item.mrpPaise),
  rating: item.rating,
  ratingCount: item.ratingCount?.toLocaleString('en-IN'),
  badge: item.badge,
  aspectRatio: item.aspectRatio,
});

const withImage = item => ({ ...item, image: item.imageUrl });
// Sections the admin arranges, rendered in the order the server sends them (hero and ad banners stay pinned on top).
const ORDERED_SECTIONS = {
  [HOME_SECTION_TYPES.recentlyViewed]: { schema: recentlyViewedItemSchema, map: withImage },
  [HOME_SECTION_TYPES.flashSale]: { schema: flashSaleItemSchema, map: item => item },
  [HOME_SECTION_TYPES.suggestedProducts]: { schema: productCardSchema, map: mapProduct },
  [HOME_SECTION_TYPES.brandSpotlight]: { schema: brandSpotlightSchema, map: withImage },
  [HOME_SECTION_TYPES.topValueDeals]: { schema: dealCardSchema, map: withImage },
  [HOME_SECTION_TYPES.productFeed]: { schema: productCardSchema, map: mapProduct },
};

export const mapHomeFeedPage = payload => {
  const { items, nextCursor } = z
    .object({ data: z.object({ items: z.array(productCardSchema), nextCursor: z.string().nullable() }) })
    .parse(payload).data;
  return { items: items.map(mapProduct), nextCursor };
};

export const mapHomeResponse = payload => {
  const data = homeResponseSchema.parse(payload).data;
  const ready = data.sections.filter(section => section.status === 'READY');
  const pinned = type => ready.find(section => section.type === type);
  const failedSections = data.sections
    .filter(section => section.status === 'ERROR')
    .map(section => ({ id: section.id, type: section.type, message: section.errorMessage }));

  const sections = [];
  for (const section of ready) {
    const known = ORDERED_SECTIONS[section.type];
    if (!known) continue;
    const items = parseItems(section, known.schema).map(known.map);
    const previous = sections[sections.length - 1];
    // Each deal campaign arrives as its own section; deals placed next to each other share one rail.
    if (section.type === HOME_SECTION_TYPES.topValueDeals && previous?.type === section.type) {
      previous.items.push(...items);
    } else {
      sections.push({ id: section.id, type: section.type, items });
    }
  }

  return {
    version: data.version,
    generatedAt: data.generatedAt,
    header: data.header,
    heroBanners: parseItems(pinned(HOME_SECTION_TYPES.hero), bannerItemSchema).map(mapBanner),
    adBanners: parseItems(pinned(HOME_SECTION_TYPES.promoCarousel), bannerItemSchema).map(
      mapBanner,
    ),
    sections: sections.filter(section => section.items.length > 0),
    failedSections,
  };
};
