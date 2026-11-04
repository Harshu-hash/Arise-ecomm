import { z } from 'zod';
import {
  adTileSchema,
  appConfigResponseSchema,
  bannerItemSchema,
  brandSpotlightSchema,
  dealCardSchema,
  homeResponseSchema,
  productCardSchema,
  recentlyViewedItemSchema,
} from './home.schemas';

export const mapAppConfigResponse = payload => appConfigResponseSchema.parse(payload).data;

export const HOME_SECTION_TYPES = Object.freeze({
  hero: 'HERO',
  promoCarousel: 'PROMO_CAROUSEL',
  recentlyViewed: 'RECENTLY_VIEWED',
  adTiles: 'AD_TILES',
  flashSale: 'FLASH_SALE',
  suggestedProducts: 'SUGGESTED_PRODUCTS',
  brandSpotlight: 'BRAND_SPOTLIGHT',
  topValueDeals: 'TOP_VALUE_DEALS',
  productFeed: 'PRODUCT_FEED',
});

const parseItems = (section, schema) => z.array(schema).parse(section?.items ?? []);
const moneyToRupees = paise => paise / 100;
const mapBanner = item => ({ id: item.id, image: item.imageUrl, target: item.target });
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

export const mapHomeResponse = payload => {
  const data = homeResponseSchema.parse(payload).data;
  const readySections = new Map(
    data.sections
      .filter(section => section.status === 'READY')
      .map(section => [section.type, section]),
  );
  const failedSections = data.sections
    .filter(section => section.status === 'ERROR')
    .map(section => ({ id: section.id, type: section.type, message: section.errorMessage }));
  const section = type => readySections.get(type);

  return {
    version: data.version,
    generatedAt: data.generatedAt,
    header: data.header,
    heroBanners: parseItems(section(HOME_SECTION_TYPES.hero), bannerItemSchema).map(mapBanner),
    adBanners: parseItems(section(HOME_SECTION_TYPES.promoCarousel), bannerItemSchema).map(
      mapBanner,
    ),
    recentlyViewed: parseItems(
      section(HOME_SECTION_TYPES.recentlyViewed),
      recentlyViewedItemSchema,
    ).map(item => ({ ...item, image: item.imageUrl })),
    adTiles: parseItems(section(HOME_SECTION_TYPES.adTiles), adTileSchema).map(item => ({
      ...item,
      image: item.imageUrl,
    })),
    showFlashSale: Boolean(section(HOME_SECTION_TYPES.flashSale)),
    suggestedProducts: parseItems(
      section(HOME_SECTION_TYPES.suggestedProducts),
      productCardSchema,
    ).map(mapProduct),
    brandsSpotlight: parseItems(
      section(HOME_SECTION_TYPES.brandSpotlight),
      brandSpotlightSchema,
    ).map(item => ({ ...item, image: item.imageUrl })),
    topValueDeals: parseItems(section(HOME_SECTION_TYPES.topValueDeals), dealCardSchema).map(
      item => ({ ...item, image: item.imageUrl }),
    ),
    productFeed: parseItems(section(HOME_SECTION_TYPES.productFeed), productCardSchema).map(
      mapProduct,
    ),
    failedSections,
  };
};
