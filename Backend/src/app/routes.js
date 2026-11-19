import { Router } from 'express';
import { env } from '../config/env.js';
import { createBannerRouter } from '../modules/admin/presentation/banner.routes.js';
import { createCampaignRouter } from '../modules/coupon/presentation/campaign.routes.js';
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
import { createSellerCatalogRouter } from '../modules/category/presentation/sellerCatalog.routes.js';
import { createListingRouter } from '../modules/product/presentation/listing.routes.js';
import { createOfferAdminRouter, createProductReviewRouter } from '../modules/product/presentation/review.routes.js';
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
import { ipAllowlist } from '../shared/middleware/ipAllowlist.js';
import { authRateLimiter } from '../shared/middleware/rateLimit.js';

const AUDIENCE_ROLES = {
  customer: [ROLES.CUSTOMER],
  seller: [ROLES.SELLER, ROLES.SELLER_STAFF],
  admin: [ROLES.ADMIN],
};
// Only seller and admin accounts are ever invited (seller staff, admin ops users).
const INVITE_AUDIENCES = ['seller', 'admin'];

export function createRoutes() {
  const root = Router();
  const system = createSystemRouter();

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
  root.get('/api/customer/v1/home', (_req, res) =>
    res.json({
      data: {
        version: '1',
        generatedAt: new Date().toISOString(),
        header: { searchPlaceholders: ['Search products'], brandTabs: [], categoryTabs: [] },
        sections: [],
      },
    }),
  );

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

  const webhooks = Router();
  webhooks.use('/payments', createPaymentWebhookRouter());
  root.use('/webhooks/v1', webhooks);

  return root;
}
