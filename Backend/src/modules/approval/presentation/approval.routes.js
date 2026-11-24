import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { decideApproval, listApprovals } from '../application/approval.service.js';

const idParams = z.object({ id: objectIdSchema });
const listQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const rejectBody = z.object({ reason: z.string().trim().min(3, 'Say why this is rejected.').max(500) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/admin/v1/approvals: requests other admins raised because an action was over their limit.
export function createAdminApprovalRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('admin.approval.view'), validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listApprovals(req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/:id/approve', requirePermission('admin.approval.decide'), validate({ params: idParams }), route(async (req, res) =>
    sendCommand(res, await decideApproval(req.params.id, { decision: 'APPROVED' }, req.auth))));
  router.post('/:id/reject', requirePermission('admin.approval.decide'), validate({ params: idParams, body: rejectBody }), route(async (req, res) =>
    sendCommand(res, await decideApproval(req.params.id, { decision: 'REJECTED', reason: req.body.reason }, req.auth))));
  return router;
}
