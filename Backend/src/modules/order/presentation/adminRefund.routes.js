import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { ConflictError } from '../../../shared/errors/AppError.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { overLimit } from '../../../shared/middleware/scope.js';
import { registerApprovalAction, requestApproval } from '../../approval/public/index.js';
import { listAdminRefunds, refundAmountPaise, retryRefund } from '../application/adminRefund.service.js';

// The console sends ranges as `initiatedAt[gte]=...`; anything it sends that is not listed is ignored.
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(40).default('-initiatedAt'),
  q: z.string().trim().max(100).optional(),
  status: z.string().max(60).optional(),
  type: z.string().max(100).optional(),
  mode: z.string().max(20).optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
  'initiatedAt[gte]': z.string().max(40).optional(),
  'initiatedAt[lte]': z.string().max(40).optional(),
}).passthrough();
const idParams = z.object({ id: z.string().trim().min(3).max(200) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/admin/v1/refunds: refunds owed to customers, across all payments.
export function createAdminRefundRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  // Retrying a refund over the admin's own refund limit waits for another admin to approve it (module approval).
  registerApprovalAction('refund.retry', { permission: 'finance.refund.retry', run: ({ refundId }, requester) => retryRefund(refundId, requester) });
  router.get('/', requirePermission('finance.refund.view'), validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listAdminRefunds(req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/:id/retry', requirePermission('finance.refund.retry'), validate({ params: idParams }), route(async (req, res) => {
    const amountPaise = await refundAmountPaise(req.params.id);
    if (!(await overLimit(req, 'refundLimit', amountPaise))) return sendData(res, await retryRefund(req.params.id, req.auth));
    const approval = await requestApproval({ kind: 'refund.retry', summary: `Retry refund of ₹${(amountPaise / 100).toLocaleString('en-IN')}`, amountPaise, payload: { refundId: req.params.id } }, req.auth);
    return sendData(res, { approvalRequired: true, approval }, { status: 202 });
  }));
  router.post('/:id/mode', requirePermission('finance.refund.switch_mode'), route(async () => {
    throw new ConflictError('REFUND_MODE_FIXED', 'Refunds go back to the original payment method; wallet and bank refunds are not available yet.');
  }));
  return router;
}
