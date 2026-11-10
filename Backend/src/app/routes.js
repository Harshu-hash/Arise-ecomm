import { Router } from 'express';
import { createPaymentWebhookRouter } from '../modules/payment/presentation/payment.webhook.routes.js';
import { createUploadRouter } from '../modules/system/presentation/upload.routes.js';
import { createSystemRouter } from '../modules/system/presentation/system.routes.js';
import { metricsHandler } from '../infrastructure/observability/metrics.js';
import { ipAllowlist } from '../shared/middleware/ipAllowlist.js';
import { authRateLimiter } from '../shared/middleware/rateLimit.js';

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
    root.use(`/api/${audience}/v1/uploads`, createUploadRouter());
    root.use(`/api/${audience}/v1`, Router());
  }

  const webhooks = Router();
  webhooks.use('/payments', createPaymentWebhookRouter());
  root.use('/webhooks/v1', webhooks);

  return root;
}
