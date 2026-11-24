import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission, userHasPermission } from '../../../shared/middleware/permission.js';
import { assertInScope, scopedIds } from '../../../shared/middleware/scope.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { QC_FAIL_CODES, REJECT_CODES } from '../domain/services/returnRules.js';
import { actOnReturn, getAdminReturn, listAdminReturns, RETURN_PERMISSIONS } from '../application/adminReturn.service.js';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(40).default('requestedAt'),
}).passthrough();
const idParams = z.object({ id: objectIdSchema });
const none = z.object({}).passthrough();
// The console also sends evidence ids and a QC checklist; they are ignored (not stored yet) rather than rejected.
const reasonBody = z.object({ reasonCode: z.enum(REJECT_CODES).default('OTHER'), reason: z.string().trim().min(3, 'Tell the customer why.').max(500) });
const cancelBody = z.object({ reason: z.string().trim().min(3, 'Say why you are cancelling this return.').max(500) });
const overrideBody = z.object({ reason: z.string().trim().min(3, 'Explain the override to the seller and customer.').max(500) });
const qcBody = z.object({ result: z.enum(['PASS', 'FAIL']), reasonCode: z.enum(QC_FAIL_CODES).nullish(), notes: z.string().trim().max(500).default('') }).superRefine((body, ctx) => {
  if (body.result === 'FAIL' && !body.reasonCode) ctx.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Say what was wrong.' });
  if (body.result === 'FAIL' && body.notes.length < 3) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Say what was wrong: the seller may claim against this.' });
});

// action -> [permission, body schema]
const ACTIONS = {
  approve: ['orders.return.approve', none],
  reject: ['orders.return.reject', reasonBody],
  'schedule-pickup': ['orders.return.reschedule', none],
  'retry-refund': ['orders.return.qc', none], // the refund after a passed QC was refused: try it again
  'mark-received': ['orders.return.mark_received', none],
  'cancel-pickup': ['orders.return.reschedule', none], // retry cancelling the courier booking of a cancelled return
  qc: ['orders.return.qc', qcBody],
  cancel: ['orders.return.reject', cancelBody], // close a return that has not been collected (or a rejected one) so the customer can ask again
  'override-rejection': ['orders.return.approve', overrideBody],
};

/** The return permissions this admin holds, so the detail only offers what they may do. */
export const grantedReturnPermissions = async (userId) => (await Promise.all(RETURN_PERMISSIONS.map(async (key) => ((await userHasPermission(userId, key)) ? key : null)))).filter(Boolean);

// Mounted at /api/admin/v1/returns: every return across all sellers, in the shape the admin console reads.
export function createAdminReturnRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  // A return of a seller outside the admin's scope answers 404.
  router.param('id', async (req, _res, next, id) => {
    try {
      const row = (await scopedIds(req, 'sellers')) && (await Return.findById(id, 'sellerId').lean());
      if (row) await assertInScope(req, 'sellers', row.sellerId, 'That return no longer exists.');
      return next();
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', requirePermission('orders.return.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listAdminReturns({ ...req.query, ...(req.query.sellerId ? (await assertInScope(req, 'sellers', req.query.sellerId), {}) : {}) }, { sellerIds: await scopedIds(req, 'sellers') });
    return sendData(res, data, { meta });
  });
  router.get('/:id', requirePermission('orders.return.view'), validate({ params: idParams }), async (req, res) => {
    const { data, meta } = await getAdminReturn(req.params.id, await grantedReturnPermissions(req.auth.userId));
    return sendData(res, data, { meta });
  });
  for (const [action, [permission, schema]] of Object.entries(ACTIONS)) {
    router.post(`/:id/${action}`, requirePermission(permission), validate({ params: idParams, body: schema }), async (req, res) => {
      const { data, meta } = await actOnReturn(req.params.id, action, req.body, req.auth, await grantedReturnPermissions(req.auth.userId));
      return sendData(res, data, { meta });
    });
  }

  return router;
}
