import { Router } from 'express';
import { env } from '../config/env.js';
import { createBannerRouter } from '../modules/admin/presentation/banner.routes.js';
import { createCmsRouter, createStaticPageRouter } from '../modules/admin/presentation/cms.routes.js';
import {
  HOME_BRAND_TABS as BRAND_TABS,
  applyBrandTabOverrides,
  applyCategoryTabOverrides,
  arrangeHomeSections,
  getPublishedPage,
  getSettingsSection,
  getPublishedSections,
  listLiveBanners,
} from '../modules/admin/public/index.js';
import { createCampaignRouter } from '../modules/coupon/presentation/campaign.routes.js';
import { createCouponRouter } from '../modules/coupon/presentation/coupon.routes.js';
import { createSellerCouponRouter } from '../modules/coupon/presentation/sellerCoupon.routes.js';
import { createAudienceReachRouter, createDealRouter } from '../modules/coupon/presentation/deal.routes.js';
import { createCustomerFlashSaleRouter, createCustomerPromotionRouter } from '../modules/coupon/presentation/customerCampaign.routes.js';
import { createCustomerCouponRouter } from '../modules/coupon/presentation/customerCoupon.routes.js';
import { createSellerCampaignRouter } from '../modules/coupon/presentation/sellerCampaign.routes.js';
import { listHomeCampaignSections } from '../modules/coupon/public/index.js';
import { createSettingsRouter } from '../modules/admin/presentation/settings.routes.js';
import { createAdminUsersRouter } from '../modules/identity/presentation/adminUsers.routes.js';
import { createAuthRouter } from '../modules/identity/presentation/auth.routes.js';
import { createCustomerAuthRouter } from '../modules/identity/presentation/customerAuth.routes.js';
import { createCustomerAddressRouter } from '../modules/customer/presentation/address.routes.js';
import { createAdminCashbackRouter, createAdminCustomerWalletRouter, createAdminGiftCardRouter } from '../modules/wallet/presentation/adminWallet.routes.js';
import { createCustomerGiftCardRouter, createCustomerWalletRouter } from '../modules/wallet/presentation/customerWallet.routes.js';
import { createReferralInviteRouter, STORE_URLS } from '../modules/referral/presentation/invite.routes.js';
import { createAdminReferralRouter, createCustomerReferralRouter } from '../modules/referral/presentation/referral.routes.js';
import { createCustomerPrivacyRouter } from '../modules/customer/presentation/privacy.routes.js';
import { createCustomerWishlistRouter } from '../modules/wishlist/presentation/wishlist.routes.js';
import { createCustomerCartRouter } from '../modules/cart/presentation/cart.routes.js';
import { registerOrderWebhooks } from '../modules/order/public/index.js';
import { createAdminInvoiceRouter, createSellerInvoiceRouter } from '../modules/order/presentation/invoice.routes.js';
import { createAdminOrderRouter } from '../modules/order/presentation/adminOrder.routes.js';
import { createSellerOrderRouter } from '../modules/order/presentation/sellerOrder.routes.js';
import { createAdminReturnRouter } from '../modules/order/presentation/adminReturn.routes.js';
import { createAdminPayoutHoldRouter, createAdminSettlementRouter, createAdminWalletRouter, createAdminWithdrawalRouter } from '../modules/settlement/presentation/adminSettlement.routes.js';
import { createSellerSettlementRouter, createSellerWalletRouter } from '../modules/settlement/presentation/sellerWallet.routes.js';
import { createSellerReturnRouter } from '../modules/order/presentation/sellerReturn.routes.js';
import { createCustomerNotificationRouter, createSellerAlertRouter } from '../modules/notification/presentation/notification.routes.js';
import { createCustomerOrderRouter } from '../modules/order/presentation/order.routes.js';
import { createCustomerReviewRouter } from '../modules/review/presentation/review.routes.js';
import { createAdminReviewRouter } from '../modules/review/presentation/adminReview.routes.js';
import { createCustomerQuestionRouter } from '../modules/review/presentation/question.routes.js';
import { createAdminAnswerRouter, createAdminQuestionRouter } from '../modules/review/presentation/adminQuestion.routes.js';
import { createAdminRefundRouter } from '../modules/order/presentation/adminRefund.routes.js';
import { createAdminPaymentRouter } from '../modules/order/presentation/adminPayment.routes.js';
import { createAdminAnalyticsRouter, createAdminDashboardRouter, createAdminMoneyRouter, createSellerAnalyticsRouter, createSellerDashboardRouter } from '../modules/analytics/presentation/analytics.routes.js';
import { createAdminBroadcastRouter } from '../modules/notification/presentation/broadcast.routes.js';
import { createAdminChatRouter, createCustomerChatRouter } from '../modules/support/presentation/chat.routes.js';
import { createAdminAriseRatingRouter, createCustomerAriseRatingRouter } from '../modules/support/presentation/ariseRating.routes.js';
import { createAdminApprovalRouter } from '../modules/approval/presentation/approval.routes.js';
import { createCustomerHelpRouter, createSellerSupportRouter } from '../modules/support/presentation/help.routes.js';
import { createAdminAbuseRouter } from '../modules/review/presentation/adminAbuse.routes.js';
import { createSellerReviewRouter } from '../modules/review/presentation/sellerReview.routes.js';
import { createInviteRouter } from '../modules/identity/presentation/invite.routes.js';
import { createMeRouter } from '../modules/identity/presentation/me.routes.js';
import { createPasswordRouter } from '../modules/identity/presentation/password.routes.js';
import { createPiiRouter } from '../modules/identity/presentation/pii.routes.js';
import { createAdminCustomersRouter } from '../modules/identity/presentation/adminCustomers.routes.js';
import { createRoleRouter } from '../modules/identity/presentation/roles.routes.js';
import { createRegistrationRouter } from '../modules/identity/presentation/registration.routes.js';
import { createSellerApplicationsRouter } from '../modules/identity/presentation/sellerApplications.routes.js';
import { createSellerSettingsRouter } from '../modules/identity/presentation/sellerSettings.routes.js';
import { createAdminSellerInquiryRouter, createCustomerSellerInquiryRouter } from '../modules/identity/presentation/sellerInquiry.routes.js';
import { createCategoryRouter } from '../modules/category/presentation/category.routes.js';
import { createCustomerCategoryRouter } from '../modules/category/presentation/customerCategory.routes.js';
import { listHomeCategoryTabs } from '../modules/category/public/index.js';
import { createSellerCatalogRouter } from '../modules/category/presentation/sellerCatalog.routes.js';
import { createCustomerSearchExtrasRouter } from '../modules/search/presentation/search.routes.js';
import { createCustomerBrandRouter, createCustomerProductRouter, createCustomerRecentlyViewedRouter, createCustomerSearchRouter } from '../modules/product/presentation/customerCatalog.routes.js';
import { listHomeProductFeed, listHomeSections } from '../modules/product/public/index.js';
import { createListingRouter } from '../modules/product/presentation/listing.routes.js';
import { createInventoryRouter } from '../modules/product/presentation/inventory.routes.js';
import { createOfferAdminRouter, createProductReviewRouter } from '../modules/product/presentation/review.routes.js';
import { createBannerAdAdminRouter, createBannerAdSellerRouter } from '../modules/bannerAd/presentation/bannerAd.routes.js';
import { listLiveAdBanners, registerBannerAdWebhooks } from '../modules/bannerAd/public/index.js';
import { createMediaRouter } from '../modules/media/presentation/media.routes.js';
import { createAttributeRouter, createAttributeSetRouter } from '../modules/attribute/presentation/attribute.routes.js';
import { createBrandRouter } from '../modules/catalog/presentation/brand.routes.js';
import { createSizeChartRouter } from '../modules/catalog/presentation/sizeChart.routes.js';
import { createShippingWebhookRouter } from '../modules/shipping/presentation/shipping.webhook.routes.js';
import { createPaymentWebhookRouter } from '../modules/payment/presentation/payment.webhook.routes.js';
import { createAuditRouter } from '../modules/system/presentation/audit.routes.js';
import { createLookupRouter } from '../modules/system/presentation/lookup.routes.js';
import { createCustomerMediaRouter, createUploadRouter } from '../modules/system/presentation/upload.routes.js';
import { createSystemRouter } from '../modules/system/presentation/system.routes.js';
import { metricsHandler } from '../infrastructure/observability/metrics.js';
import { ROLES } from '../shared/constants/roles.js';
import { objectIdSchema } from '../shared/validators/common.js';
import { optionalAuthenticate } from '../shared/middleware/authenticate.js';
import { notifyAdminOnWrite } from '../infrastructure/realtime/adminEvents.js';
import { notifyCatalogOnWrite, onCatalogChange } from '../infrastructure/realtime/catalogEvents.js';
import { ttlMemo } from '../shared/utils/ttlMemo.js';
import { ipAllowlist } from '../shared/middleware/ipAllowlist.js';
import { authRateLimiter } from '../shared/middleware/rateLimit.js';

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
// The console's Home layout page decides the header tabs (label, colour, order, visibility) and, once a layout is
// published, which home sections appear and in what order. Until then the built-in defaults apply unchanged.
const homeTabs = ttlMemo(async () => applyCategoryTabOverrides(await listHomeCategoryTabs()), 15_000);
const homeBrandTabs = ttlMemo(() => applyBrandTabOverrides(BRAND_TABS), 15_000);
const homeLayout = ttlMemo(() => getPublishedSections(), 15_000);
const homeForYou = ttlMemo(async () => {
  const { forYouColor, forYouImage, forYouImageOpacity } = await getSettingsSection('homeHeader');
  return { ...HOME_TAB, gradient: [forYouColor, '#FFFFFF'], backgroundImageUrl: forYouImage || null, backgroundImageOpacity: forYouImageOpacity / 100 };
}, 15_000);
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
for (const memo of [homeForYou, homeTabs, homeBrandTabs, homeLayout, homePage, homeCampaigns]) onCatalogChange(memo.clear);

export function createRoutes() {
  const root = Router();
  const system = createSystemRouter();

  // Admin edits (products, campaigns, banners, categories, ...) and seller listing/campaign edits change what shoppers
  // see: every successful write there clears the home caches and pushes a refetch hint to customer apps.
  root.use('/api/admin/v1', notifyCatalogOnWrite);
  root.use(['/api/seller/v1/listings', '/api/seller/v1/inventory', '/api/seller/v1/campaigns', '/api/seller/v1/coupons'], notifyCatalogOnWrite);
  // Other open admin consoles refetch these pages when a colleague changes them (events: marketing:changed, cms:changed).
  root.use(['/api/admin/v1/coupons', '/api/admin/v1/deals', '/api/seller/v1/coupons'], notifyAdminOnWrite('marketing'));
  root.use(['/api/admin/v1/cms', '/api/admin/v1/static-pages'], notifyAdminOnWrite('cms'));

  root.use('/health', system);
  root.get('/metrics', metricsHandler); // bearer-token protected; 404 when METRICS_TOKEN is unset

  // The customer contract defines GET /api/customer/v1/health.
  root.get('/api/customer/v1/health', (req, res, next) => {
    req.url = '/health';
    system(req, res, next);
  });
  root.get('/api/customer/v1/app-config', async (_req, res, next) => {
    try {
      // app-config is what the app reads first: a settings problem must not take it down, so fall back to the defaults.
      const { platformName, logoUrl } = await getSettingsSection('general').catch(() => ({ platformName: 'Arise', logoUrl: '' }));
      return res.json({
      data: {
        brand: { name: platformName, logoUrl: logoUrl || null },
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.0',
        maintenance: { enabled: false, message: null },
        storeUrls: STORE_URLS,
        featureFlags: { wallet: true, referrals: true, productQuestions: true },
      },
    });
    } catch (error) {
      return next(error);
    }
  });
  // ?categoryId=<id> is a header category tab's page; absent (or the reserved "foryou" tab) is the main home feed.
  root.get('/api/customer/v1/home', optionalAuthenticate, async (req, res, next) => {
    try {
      const requested = req.query.categoryId;
      const categoryId = typeof requested === 'string' && requested !== HOME_TAB.id ? requested : null;
      const valid = !categoryId || objectIdSchema.safeParse(categoryId).success;
      const [{ hero, feed, ads, tabs }, extras, campaigns, brandTabs, layout] = await Promise.all([
        valid ? homePage(categoryId) : homeTabs().then((headerTabs) => ({ hero: [], feed: [], ads: [], tabs: headerTabs })),
        // Recently viewed / suggested / brand spotlight belong to the main For You page; the first is per customer.
        valid && !categoryId ? listHomeSections({ userId: req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null }) : { recentlyViewed: [], suggested: [], brands: [] },
        // Admin campaigns placed on the home page: the flash-sale banner and the Top Value Deals cards.
        valid && !categoryId ? homeCampaigns() : { flashSales: [], topValueDeals: [] },
        homeBrandTabs(),
        // Only the main For You page follows the published home layout; category pages keep their own hero + feed.
        !categoryId ? homeLayout() : null,
      ]);
      const built = [
        ...(hero.length ? [{ id: 'hero', type: 'HERO', status: 'READY', items: hero }] : []),
        ...(extras.recentlyViewed.length ? [{ id: 'recently-viewed', type: 'RECENTLY_VIEWED', status: 'READY', items: extras.recentlyViewed }] : []),
        ...(ads.length ? [{ id: 'promo-carousel', type: 'PROMO_CAROUSEL', status: 'READY', items: ads }] : []),
        ...(extras.suggested.length ? [{ id: 'suggested', type: 'SUGGESTED_PRODUCTS', status: 'READY', items: extras.suggested }] : []),
        // One section per campaign, so the published layout can place each flash sale / deal on its own.
        ...campaigns.flashSales.map((sale) => ({ id: `flash-sale-${sale.id}`, type: 'FLASH_SALE', campaignId: sale.id, status: 'READY', items: [sale] })),
        ...campaigns.topValueDeals.map((deal) => ({ id: `top-value-deal-${deal.id}`, type: 'TOP_VALUE_DEALS', campaignId: deal.id, status: 'READY', items: deal.products })),
        ...(extras.brands.length ? [{ id: 'brand-spotlight', type: 'BRAND_SPOTLIGHT', status: 'READY', items: extras.brands }] : []),
        ...(feed.length ? [{ id: 'product-feed', type: 'PRODUCT_FEED', status: 'READY', items: feed }] : []),
      ];
      res.json({
        data: {
          version: '1',
          generatedAt: new Date().toISOString(),
          header: { searchPlaceholders: ['Search products'], brandTabs, categoryTabs: [await homeForYou(), ...tabs] },
          sections: arrangeHomeSections(built, layout),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  // Infinite scroll for the "You May Also Like" grid: /home carries the first page, this serves the following ones.
  root.get('/api/customer/v1/home/feed', async (req, res, next) => {
    try {
      const categoryId = typeof req.query.categoryId === 'string' && req.query.categoryId !== HOME_TAB.id ? req.query.categoryId : null;
      if (categoryId && !objectIdSchema.safeParse(categoryId).success) return res.json({ data: { items: [], nextCursor: null } });
      const offset = Math.max(0, parseInt(req.query.cursor, 10) || 0);
      const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const items = await listHomeProductFeed({ categoryId, limit: limit + 1, offset });
      res.json({ data: { items: items.slice(0, limit), nextCursor: items.length > limit ? String(offset + limit) : null } });
    } catch (error) {
      next(error);
    }
  });
  // Policy pages (privacy, terms, return/shipping/seller policy) as the admin last published them.
  root.get('/api/customer/v1/pages/:slug', async (req, res, next) => {
    try {
      const page = await getPublishedPage(req.params.slug);
      if (!page) return res.status(404).json({ error: { message: 'That page is not available.' } });
      res.json({ data: page });
    } catch (error) {
      next(error);
    }
  });
  root.use('/api/customer/v1/categories', createCustomerCategoryRouter());
  root.use('/api/customer/v1/products', createCustomerProductRouter());
  root.use('/api/customer/v1/search', createCustomerSearchRouter());
  root.use('/api/customer/v1/search', createCustomerSearchExtrasRouter());
  root.use('/api/customer/v1/brands', createCustomerBrandRouter());
  root.use('/api/customer/v1/me/recently-viewed', createCustomerRecentlyViewedRouter());
  root.use('/api/customer/v1/media', createCustomerMediaRouter());
  root.use('/api/customer/v1/flash-sales', createCustomerFlashSaleRouter());
  root.use('/api/customer/v1/coupons', createCustomerCouponRouter());
  root.use('/api/customer/v1/wallet', createCustomerWalletRouter());
  root.use('/api/customer/v1/gift-cards', createCustomerGiftCardRouter());
  root.use('/api/customer/v1/referrals', createCustomerReferralRouter());
  root.use('/invite', createReferralInviteRouter());
  root.use('/api/customer/v1/promotions', createCustomerPromotionRouter({ brandTabs: BRAND_TABS }));
  root.use('/api/customer/v1', createCustomerAddressRouter());
  root.use('/api/customer/v1', createCustomerPrivacyRouter());
  root.use('/api/customer/v1', createCustomerWishlistRouter());
  root.use('/api/customer/v1', createCustomerCartRouter());
  root.use('/api/customer/v1', createCustomerOrderRouter());
  root.use('/api/customer/v1', createCustomerNotificationRouter());
  root.use('/api/customer/v1', createCustomerReviewRouter());
  root.use('/api/customer/v1', createCustomerQuestionRouter());
  root.use('/api/customer/v1', createCustomerSellerInquiryRouter());
  root.use('/api/customer/v1', createCustomerChatRouter());
  root.use('/api/customer/v1', createCustomerAriseRatingRouter());
  root.use('/api/customer/v1/help', createCustomerHelpRouter());

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
  root.use('/api/admin/v1/customers', createAdminCustomersRouter());
  root.use('/api/admin/v1/admin/settings', createSettingsRouter());
  root.use('/api/admin/v1/banners', createBannerRouter());
  root.use('/api/admin/v1/banner-ads', createBannerAdAdminRouter());
  root.use('/api/admin/v1/campaigns/reach', createAudienceReachRouter()); // before the campaign router: "reach" is not an id
  root.use('/api/admin/v1/campaigns', createCampaignRouter());
  root.use('/api/admin/v1/coupons', createCouponRouter());
  root.use('/api/admin/v1/referrals', createAdminReferralRouter());
  root.use('/api/admin/v1/customer-wallets', createAdminCustomerWalletRouter());
  root.use('/api/admin/v1/gift-cards', createAdminGiftCardRouter());
  root.use('/api/admin/v1/cashback-rules', createAdminCashbackRouter());
  root.use('/api/admin/v1/reviews', createAdminReviewRouter());
  root.use('/api/admin/v1/chats', createAdminChatRouter());
  root.use('/api/admin/v1/arise-ratings', createAdminAriseRatingRouter());
  root.use('/api/admin/v1/approvals', createAdminApprovalRouter());
  root.use('/api/admin/v1/abuse-reports', createAdminAbuseRouter());
  root.use('/api/admin/v1/push-broadcasts', createAdminBroadcastRouter());
  root.use('/api/admin/v1/dashboard', createAdminDashboardRouter());
  root.use('/api/admin/v1/finance', createAdminMoneyRouter());
  root.use('/api/admin/v1/reports/analytics', createAdminAnalyticsRouter());
  root.use('/api/admin/v1/questions', createAdminQuestionRouter());
  root.use('/api/admin/v1/answers', createAdminAnswerRouter());
  root.use('/api/admin/v1/orders', createAdminOrderRouter());
  root.use('/api/admin/v1/payments', createAdminPaymentRouter());
  root.use('/api/admin/v1/refunds', createAdminRefundRouter());
  root.use('/api/admin/v1/returns', createAdminReturnRouter());
  root.use('/api/admin/v1/invoices', createAdminInvoiceRouter());
  root.use('/api/admin/v1/settlements', createAdminSettlementRouter());
  root.use('/api/admin/v1/withdrawals', createAdminWithdrawalRouter());
  root.use('/api/admin/v1/seller-wallets', createAdminWalletRouter());
  root.use('/api/admin/v1/deals', createDealRouter());
  root.use('/api/admin/v1/cms', createCmsRouter());
  root.use('/api/admin/v1/static-pages', createStaticPageRouter());
  root.use('/api/admin/v1/lookups', createLookupRouter());
  root.use('/api/admin/v1/categories', createCategoryRouter());
  root.use('/api/admin/v1/attributes', createAttributeRouter());
  root.use('/api/admin/v1/attribute-sets', createAttributeSetRouter());
  root.use('/api/admin/v1/brands', createBrandRouter());
  root.use('/api/admin/v1/size-charts', createSizeChartRouter());
  root.use('/api/admin/v1/sellers', createAdminPayoutHoldRouter()); // before the seller applications router: it only answers POST /:id/payout-hold
  root.use('/api/admin/v1/seller-inquiries', createAdminSellerInquiryRouter());
  root.use('/api/admin/v1/sellers', createSellerApplicationsRouter());
  root.use('/api/admin/v1/products', createProductReviewRouter());
  root.use('/api/admin/v1/offers', createOfferAdminRouter());
  root.use('/api/admin/v1/pii', createPiiRouter());
  root.use('/api/admin/v1/audit-events', createAuditRouter());
  root.use('/api/seller/v1/customer-experience', createSellerReviewRouter());
  root.use('/api/seller/v1/settings', createSellerSettingsRouter());
  root.use('/api/seller/v1/support', createSellerSupportRouter());
  root.use('/api/seller/v1/catalog', createSellerCatalogRouter());
  root.use('/api/seller/v1/listings', createListingRouter());
  root.use('/api/seller/v1/inventory', createInventoryRouter());
  root.use('/api/seller/v1/orders', createSellerOrderRouter());
  root.use('/api/seller/v1/returns', createSellerReturnRouter());
  root.use('/api/seller/v1/finance/invoices', createSellerInvoiceRouter());
  root.use('/api/seller/v1/finance', createSellerWalletRouter());
  root.use('/api/seller/v1/settlements', createSellerSettlementRouter());
  root.use('/api/seller/v1/dashboard', createSellerAlertRouter());
  root.use('/api/seller/v1/dashboard', createSellerDashboardRouter());
  root.use('/api/seller/v1/analytics', createSellerAnalyticsRouter());
  root.use('/api/seller/v1/banner-ads', createBannerAdSellerRouter());
  root.use('/api/seller/v1/campaigns', createSellerCampaignRouter());
  root.use('/api/seller/v1/coupons', createSellerCouponRouter());
  registerBannerAdWebhooks();
  registerOrderWebhooks();

  const webhooks = Router();
  webhooks.use('/payments', createPaymentWebhookRouter());
  webhooks.use('/shipping', createShippingWebhookRouter());
  root.use('/webhooks/v1', webhooks);

  return root;
}
