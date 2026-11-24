import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { listAdminPayments } from '../application/adminPayment.service.js';

// The console sends ranges as `createdAt[gte]=...`; anything it sends that is not listed is ignored.
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(40).default('-createdAt'),
  q: z.string().trim().max(100).optional(),
  status: z.string().max(40).optional(),
  method: z.string().max(100).optional(),
  gateway: z.string().max(100).optional(),
  'createdAt[gte]': z.string().max(40).optional(),
  'createdAt[lte]': z.string().max(40).optional(),
  'amountPaise[gte]': z.string().max(20).optional(),
  'amountPaise[lte]': z.string().max(20).optional(),
}).passthrough();

// Mounted at /api/admin/v1/payments: every payment attempt across all customers, read-only.
export function createAdminPaymentRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('finance.payment.view'), validate({ query: listQuery }), async (req, res, next) => {
    try {
      const { data, meta } = await listAdminPayments(req.query);
      return sendData(res, data, { meta });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
