import { Router } from 'express';
import { env } from '../config/env.js';
import { createAdminUsersRouter } from '../modules/identity/presentation/adminUsers.routes.js';
import { createAuthRouter } from '../modules/identity/presentation/auth.routes.js';
import { createInviteRouter } from '../modules/identity/presentation/invite.routes.js';
import { createMeRouter } from '../modules/identity/presentation/me.routes.js';
import { createPasswordRouter } from '../modules/identity/presentation/password.routes.js';
import { createPiiRouter } from '../modules/identity/presentation/pii.routes.js';
import { createRegistrationRouter } from '../modules/identity/presentation/registration.routes.js';
import { createSellerApplicationsRouter } from '../modules/identity/presentation/sellerApplications.routes.js';
import { createSellerSettingsRouter } from '../modules/identity/presentation/sellerSettings.routes.js';
import { createPaymentWebhookRouter } from '../modules/payment/presentation/payment.webhook.routes.js';
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

  // Brute-force protection: stricter per-IP bucket on every audience's auth routes.
  const authLimiter = authRateLimiter();
  for (const audience of ['customer', 'seller', 'admin']) root.use(`/api/${audience}/v1/auth`, authLimiter);

  // Feature routers are mounted by audience, while use-cases live in domain modules.
  root.use('/api/admin/v1', ipAllowlist()); // network restriction first, so it also guards admin uploads
  for (const audience of ['customer', 'seller', 'admin']) {
    const cookiePath = `/api/${audience}/v1/auth`;
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
    root.use(`/api/${audience}/v1/me`, createMeRouter());
    root.use(`/api/${audience}/v1/uploads`, createUploadRouter());
  }
  root.use('/api/admin/v1/admin-users', createAdminUsersRouter());
  root.use('/api/admin/v1/sellers', createSellerApplicationsRouter());
  root.use('/api/admin/v1/pii', createPiiRouter());
  root.use('/api/seller/v1/settings', createSellerSettingsRouter());

  const webhooks = Router();
  webhooks.use('/payments', createPaymentWebhookRouter());
  root.use('/webhooks/v1', webhooks);

  return root;
}
