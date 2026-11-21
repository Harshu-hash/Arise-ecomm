// Home layout sections the console can place. Order and on/off are the admin's; each section's `config` is free-form JSON.
export const HOME_SECTION_TYPES = [
  'HERO_BANNER_CAROUSEL',
  'AD_SHEET_CARD',
  'RECENTLY_VIEWED_RAIL',
  'FLASH_SALE_BANNER',
  'AD_TILE_ROW',
  'SUGGESTED_FOR_YOU',
  'BRANDS_SPOTLIGHT',
  'TOP_VALUE_DEALS',
  'PRODUCT_FEED',
  'SPONSORED_RAIL',
];
// Kept at the top of the home screen in a fixed order; every other row can be moved.
export const PINNED_SECTION_TYPES = ['HERO_BANNER_CAROUSEL', 'AD_TILE_ROW', 'AD_SHEET_CARD'];
// One row per campaign (identified by `campaignId`), so each flash sale / deal can be placed on its own.
export const PER_CAMPAIGN_SECTION_TYPES = ['FLASH_SALE_BANNER', 'TOP_VALUE_DEALS'];
export const MAX_HOME_SECTIONS = 100;
// The only setting the customer home applies today: how many items a section shows (blank = all of them).
export const MAX_ITEMS_RANGE = Object.freeze({ min: 1, max: 30 });
// Sections that can be limited this way; any other setting sent for a section is dropped on save.
export const SECTIONS_WITH_MAX_ITEMS = [
  'HERO_BANNER_CAROUSEL',
  'RECENTLY_VIEWED_RAIL',
  'AD_TILE_ROW',
  'SUGGESTED_FOR_YOU',
  'BRANDS_SPOTLIGHT',
  'PRODUCT_FEED',
];
export const MAX_HOME_VERSIONS = 50;

// A version's status is its slot: at most one DRAFT and one PUBLISHED exist; everything else is ARCHIVED (no slot).
export const HOME_SLOT = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' });
export const HOME_VERSION_STATUS = Object.freeze({ ...HOME_SLOT, ARCHIVED: 'ARCHIVED' });

// How each section type the customer home screen already builds relates to a console section type.
export const CUSTOMER_SECTION_FOR = Object.freeze({
  HERO: ['HERO_BANNER_CAROUSEL'],
  RECENTLY_VIEWED: ['RECENTLY_VIEWED_RAIL'],
  PROMO_CAROUSEL: ['AD_TILE_ROW', 'AD_SHEET_CARD'],
  SUGGESTED_PRODUCTS: ['SUGGESTED_FOR_YOU'],
  FLASH_SALE: ['FLASH_SALE_BANNER'],
  TOP_VALUE_DEALS: ['TOP_VALUE_DEALS'],
  BRAND_SPOTLIGHT: ['BRANDS_SPOTLIGHT'],
  PRODUCT_FEED: ['PRODUCT_FEED'],
});

// Fixed storefront switch in the home header; same shape as the app. The console manages its label and visibility.
export const HOME_BRAND_TABS = [
  {
    id: 'arise', label: 'Arise', icon: 'sunrise', badge: 'MARKET',
    activeBg: '#FFE11B', activeText: '#002F6C', activeIcon: '#002F6C',
    badgeBg: '#002F6C', badgeText: '#FFE11B', gradient: ['#FFE11B', '#FFC200'],
  },
  {
    id: 'value365', label: 'Deals', icon: 'percent', badge: '365 DEALS',
    activeBg: '#D32F2F', activeText: '#FFFFFF', activeIcon: '#FFD700',
    badgeBg: '#FFD700', badgeText: '#8B0000', gradient: ['#E52E2E', '#900C1F'],
  },
];

// Policy pages every storefront needs. Bodies start empty: only what an admin writes is ever shown.
export const STATIC_PAGES = [
  { slug: 'about', title: 'About Arise' },
  { slug: 'privacy-policy', title: 'Privacy Policy' },
  { slug: 'terms', title: 'Terms & Conditions' },
  { slug: 'return-policy', title: 'Return Policy' },
  { slug: 'shipping-policy', title: 'Shipping Policy' },
  { slug: 'seller-policy', title: 'Seller Policy' },
];
export const PAGE_STATUS = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' });
export const MAX_PAGE_BODY = 100_000;
export const MAX_PAGE_VERSIONS = 50;
