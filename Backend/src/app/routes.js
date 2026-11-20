import { Router } from 'express';
import { env } from '../config/env.js';
import { createBannerRouter } from '../modules/admin/presentation/banner.routes.js';
import { listLiveBanners } from '../modules/admin/public/index.js';
import { createCampaignRouter } from '../modules/coupon/presentation/campaign.routes.js';
import { createCustomerFlashSaleRouter, createCustomerPromotionRouter } from '../modules/coupon/presentation/customerCampaign.routes.js';
import { createSellerCampaignRouter } from '../modules/coupon/presentation/sellerCampaign.routes.js';
import { listHomeCampaignSections } from '../modules/coupon/public/index.js';
import { createSettingsRouter } from '../modules/admin/presentation/settings.routes.js';
import { createAdminUsersRouter } from '../modules/identity/presentation/adminUsers.routes.js';
import { createAuthRouter } from '../modules/identity/presentation/auth.routes.js';
import { createCustomerAuthRouter } from '../modules/identity/presentation/customerAuth.routes.js';
import { createInviteRouter } from '../modules/identity/presentation/invite.routes.js';
import { createMeRouter } from '../modules/identity/presentation/me.routes.js';
import { createPasswordRouter } from '../modules/identity/presentation/password.routes.js';
import { createPiiRouter } from '../modules/identity/presentation/pii.routes.js';
import { createRoleRouter } from '../modules/identity/presentation/roles.routes.js';
import { createRegistrationRouter } from '../modules/identity/presentation/registration.routes.js';
import { createSellerApplicationsRouter } from '../modules/identity/presentation/sellerApplications.routes.js';
import { createSellerSettingsRouter } from '../modules/identity/presentation/sellerSettings.routes.js';
import { createCategoryRouter } from '../modules/category/presentation/category.routes.js';
import { createCustomerCategoryRouter } from '../modules/category/presentation/customerCategory.routes.js';
import { listHomeCategoryTabs } from '../modules/category/public/index.js';
import { createSellerCatalogRouter } from '../modules/category/presentation/sellerCatalog.routes.js';
import { createCustomerProductRouter, createCustomerSearchRouter } from '../modules/product/presentation/customerCatalog.routes.js';
import { listHomeProductFeed, listHomeSections } from '../modules/product/public/index.js';
import { createListingRouter } from '../modules/product/presentation/listing.routes.js';
import { createOfferAdminRouter, createProductReviewRouter } from '../modules/product/presentation/review.routes.js';
import { createBannerAdAdminRouter, createBannerAdSellerRouter } from '../modules/bannerAd/presentation/bannerAd.routes.js';
import { listLiveAdBanners, registerBannerAdWebhooks } from '../modules/bannerAd/public/index.js';
import { createMediaRouter } from '../modules/media/presentation/media.routes.js';
import { createAttributeRouter, createAttributeSetRouter } from '../modules/attribute/presentation/attribute.routes.js';
import { createBrandRouter } from '../modules/catalog/presentation/brand.routes.js';
import { createSizeChartRouter } from '../modules/catalog/presentation/sizeChart.routes.js';
import { createPaymentWebhookRouter } from '../modules/payment/presentation/payment.webhook.routes.js';
import { createAuditRouter } from '../modules/system/presentation/audit.routes.js';
import { createUploadRouter } from '../modules/system/presentation/upload.routes.js';
import { createSystemRouter } from '../modules/system/presentation/system.routes.js';
import { metricsHandler } from '../infrastructure/observability/metrics.js';
import { ROLES } from '../shared/constants/roles.js';
import { objectIdSchema } from '../shared/validators/common.js';
import { optionalAuthenticate } from '../shared/middleware/authenticate.js';
import { notifyCatalogOnWrite, onCatalogChange } from '../infrastructure/realtime/catalogEvents.js';
import { ttlMemo } from '../shared/utils/ttlMemo.js';
import { ipAllowlist } from '../shared/middleware/ipAllowlist.js';
import { authRateLimiter } from '../shared/middleware/rateLimit.js';

// Fixed storefront switch in the home header (no admin screen manages it yet); same shape as the app's mock.
const BRAND_TABS = [
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

// Reserved first tab: the home feed itself. Real category ids are ObjectIds, so it cannot collide.
const HOME_TAB = { id: 'foryou', label: 'For You', icon: 'shopping-bag', gradient: ['#FFCB9D', '#FFFFFF'] };

const AUDIENCE_ROLES = {
  customer: [ROLES.CUSTOMER],
  seller: [ROLES.SELLER, ROLES.SELLER_STAFF],
  admin: [ROLES.ADMIN],
};
// Only seller and admin accounts are ever invited (seller staff, admin ops users).
const INVITE_AUDIENCES = ['seller', 'admin'];

// Every query below is a database round trip; the home screen is hit on every tab switch, so a page is
// built once per 15s per category (all four reads in parallel) and shared by concurrent callers.
const homeTabs = ttlMemo(() => listHomeCategoryTabs(), 15_000);
const homeCampaigns = ttlMemo(() => listHomeCampaignSections(), 15_000);
const homePage = ttlMemo(async (categoryId) => {
  const [hero, feed, ads, tabs] = await Promise.all([
    listLiveBanners(categoryId ? 'CATEGORY_HERO' : 'HOME_HERO', { categoryId }),
    listHomeProductFeed({ categoryId }),
    // The carousel under the hero is the paid shop-banner slots, booked per page (For You or a header category).
    listLiveAdBanners({ categoryId }),
    homeTabs(),
  ]);
  return { hero, feed, ads, tabs };
}, 15_000);
for (const memo of [homeTabs, homePage, homeCampaigns]) onCatalogChange(memo.clear);

export function createRoutes() {
  const root = Router();
  const system = createSystemRouter();

  // Admin edits (products, campaigns, banners, categories, ...) and seller listing/campaign edits change what shoppers
  // see: every successful write there clears the home caches and pushes a refetch hint to customer apps.
  root.use('/api/admin/v1', notifyCatalogOnWrite);
  root.use(['/api/seller/v1/listings', '/api/seller/v1/campaigns'], notifyCatalogOnWrite);

  root.use('/health', system);
  root.get('/metrics', metricsHandler); // bearer-token protected; 404 when METRICS_TOKEN is unset

  // The customer contract defines GET /api/customer/v1/health.
  root.get('/api/customer/v1/health', (req, res, next) => {
    req.url = '/health';
    system(req, res, next);
  });
  root.get('/api/customer/v1/app-config', (_req, res) =>
    res.json({
      data: {
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.0',
        maintenance: { enabled: false, message: null },
        storeUrls: {
          android: 'market://details?id=com.ariseecommerce',
          ios: 'https://apps.apple.com/app/arise-marketplace/id0000000000',
        },
        featureFlags: { wallet: true, referrals: true, productQuestions: true },
      },
    }),
  );
  // ?categoryId=<id> is a header category tab's page; absent (or the reserved "foryou" tab) is the main home feed.
  root.get('/api/customer/v1/home', optionalAuthenticate, async (req, res, next) => {
    try {
      const requested = req.query.categoryId;
      const categoryId = typeof requested === 'string' && requested !== HOME_TAB.id ? requested : null;
      const valid = !categoryId || objectIdSchema.safeParse(categoryId).success;
      const [{ hero, feed, ads, tabs }, extras, campaigns] = await Promise.all([
        valid ? homePage(categoryId) : homeTabs().then((headerTabs) => ({ hero: [], feed: [], ads: [], tabs: headerTabs })),
        // Recently viewed / suggested / brand spotlight belong to the main For You page; the first is per customer.
        valid && !categoryId ? listHomeSections({ userId: req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null }) : { recentlyViewed: [], suggested: [], brands: [] },
        // Admin campaigns placed on the home page: the flash-sale banner and the Top Value Deals cards.
        valid && !categoryId ? homeCampaigns() : { flashSale: null, topValueDeals: [] },
      ]);
      const sections = [
        ...(hero.length ? [{ id: 'hero', type: 'HERO', status: 'READY', items: hero }] : []),
        ...(extras.recentlyViewed.length ? [{ id: 'recently-viewed', type: 'RECENTLY_VIEWED', status: 'READY', items: extras.recentlyViewed }] : []),
        ...(ads.length ? [{ id: 'promo-carousel', type: 'PROMO_CAROUSEL', status: 'READY', items: ads }] : []),
        ...(extras.suggested.length ? [{ id: 'suggested', type: 'SUGGESTED_PRODUCTS', status: 'READY', items: extras.suggested }] : []),
        ...(campaigns.flashSale ? [{ id: 'flash-sale', type: 'FLASH_SALE', status: 'READY', items: [], metadata: campaigns.flashSale }] : []),
        ...(campaigns.topValueDeals.length ? [{ id: 'top-value-deals', type: 'TOP_VALUE_DEALS', status: 'READY', items: campaigns.topValueDeals }] : []),
        ...(extras.brands.length ? [{ id: 'brand-spotlight', type: 'BRAND_SPOTLIGHT', status: 'READY', items: extras.brands }] : []),
        ...(feed.length ? [{ id: 'product-feed', type: 'PRODUCT_FEED', status: 'READY', items: feed }] : []),
      ];
      res.json({
        data: {
          version: '1',
          generatedAt: new Date().toISOString(),
          header: { searchPlaceholders: ['Search products'], brandTabs: BRAND_TABS, categoryTabs: [HOME_TAB, ...tabs] },
          sections,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  root.use('/api/customer/v1/categories', createCustomerCategoryRouter());
  root.use('/api/customer/v1/products', createCustomerProductRouter());
  root.use('/api/customer/v1/search', createCustomerSearchRouter());
  root.use('/api/customer/v1/flash-sales', createCustomerFlashSaleRouter());
  root.use('/api/customer/v1/promotions', createCustomerPromotionRouter({ brandTabs: BRAND_TABS }));

  // Brute-force protection: stricter per-IP bucket on every audience's auth routes.
  const authLimiter = authRateLimiter();
  for (const audience of ['customer', 'seller', 'admin']) root.use(`/api/${audience}/v1/auth`, authLimiter);

  // Feature routers are mounted by audience, while use-cases live in domain modules.
  root.use('/api/admin/v1', ipAllowlist()); // network restriction first, so it also guards admin uploads
  for (const audience of ['customer', 'seller', 'admin']) {
    const cookiePath = `/api/${audience}/v1/auth`;
    if (audience === 'customer') {
      root.use(cookiePath, createCustomerAuthRouter({ cookiePath }));
    } else {
      root.use(cookiePath, createAuthRouter({ allowedRoles: AUDIENCE_ROLES[audience], cookiePath }));
      root.use(
        cookiePath,
        createPasswordRouter({
          allowedRoles: AUDIENCE_ROLES[audience],
          // Placeholder until each frontend's real origin is configured per audience.
          resetUrlBase: `${env.PUBLIC_ORIGIN}/${audience}/reset-password`,
        }),
      );
      if (audience === 'seller') root.use(cookiePath, createRegistrationRouter());
      if (INVITE_AUDIENCES.includes(audience)) root.use(cookiePath, createInviteRouter({ cookiePath }));
    }
    root.use(`/api/${audience}/v1/me`, createMeRouter());
    root.use(`/api/${audience}/v1/uploads`, createUploadRouter());
    // Only seller/admin widgets currently use the media workflow (product images, CMS, ...).
    if (audience !== 'customer') root.use(`/api/${audience}/v1/media`, createMediaRouter());
  }
  root.use('/api/admin/v1/admin-users', createAdminUsersRouter());
  root.use('/api/admin/v1/roles', createRoleRouter());
  root.use('/api/admin/v1/admin/settings', createSettingsRouter());
  root.use('/api/admin/v1/banners', createBannerRouter());
  root.use('/api/admin/v1/banner-ads', createBannerAdAdminRouter());
  root.use('/api/admin/v1/campaigns', createCampaignRouter());
  root.use('/api/admin/v1/categories', createCategoryRouter());
  root.use('/api/admin/v1/attributes', createAttributeRouter());
  root.use('/api/admin/v1/attribute-sets', createAttributeSetRouter());
  root.use('/api/admin/v1/brands', createBrandRouter());
  root.use('/api/admin/v1/size-charts', createSizeChartRouter());
  root.use('/api/admin/v1/sellers', createSellerApplicationsRouter());
  root.use('/api/admin/v1/products', createProductReviewRouter());
  root.use('/api/admin/v1/offers', createOfferAdminRouter());
  root.use('/api/admin/v1/pii', createPiiRouter());
  root.use('/api/admin/v1/audit-events', createAuditRouter());
  root.use('/api/seller/v1/settings', createSellerSettingsRouter());
  root.use('/api/seller/v1/catalog', createSellerCatalogRouter());
  root.use('/api/seller/v1/listings', createListingRouter());
  root.use('/api/seller/v1/banner-ads', createBannerAdSellerRouter());
  root.use('/api/seller/v1/campaigns', createSellerCampaignRouter());
  registerBannerAdWebhooks();

  const webhooks = Router();
  webhooks.use('/payments', createPaymentWebhookRouter());
  root.use('/webhooks/v1', webhooks);

  return root;
}
