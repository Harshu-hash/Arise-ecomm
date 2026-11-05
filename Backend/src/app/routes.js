import { Router } from 'express';
import { createSystemRouter } from '../modules/system/presentation/system.routes.js';

export function createRoutes() {
  const root = Router();
  const system = createSystemRouter();

  root.use('/health', system);

  // The customer contract defines GET /api/customer/v1/health.
  root.get('/api/customer/v1/health', (req, res, next) => {
    req.url = '/health';
    system(req, res, next);
  });

  // Feature routers are mounted by audience, while use-cases live in domain modules.
  root.use('/api/customer/v1', Router());
  root.use('/api/seller/v1', Router());
  root.use('/api/admin/v1', Router());
  root.use('/webhooks/v1', Router());

  return root;
}

