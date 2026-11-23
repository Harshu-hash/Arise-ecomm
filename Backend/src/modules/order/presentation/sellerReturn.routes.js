import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { QC_FAIL_CODES, REJECT_CODES, SELLER_STAGES } from '../domain/services/returnRules.js';
import { approveReturn, getSellerReturn, listSellerReturns, receiveReturn, recordReturnQc, rejectReturn, schedulePickupFor } from '../application/sellerReturn.service.js';

const listQuery = pageQuery.extend({
  sort: z.string().default('-requestedAt'),
  stage: z.enum(['all', ...Object.keys(SELLER_STAGES)]).optional().transform((stage) => (stage === 'all' ? undefined : stage)),
});
const idParams = z.object({ id: objectIdSchema });
// The panel also sends evidenceMediaIds; they are ignored (not stored yet) rather than rejected.
const rejectBody = z.object({ reasonCode: z.enum(REJECT_CODES).default('OTHER'), reason: z.string().trim().min(3, 'Tell the customer why.').max(500) });
const qcBody = z.object({
  result: z.enum(['PASS', 'FAIL']),
  reasonCode: z.enum(QC_FAIL_CODES).nullish(),
  notes: z.string().trim().max(500).default(''),
}).superRefine((body, ctx) => {
  if (body.result === 'FAIL' && !body.reasonCode) ctx.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Say what was wrong.' });
  if (body.result === 'FAIL' && body.notes.length < 3) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Say what was wrong: the customer sees this.' });
});

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/returns: return requests on the seller's own parcels, in the shape the seller panel reads.
export function createSellerReturnRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));
  const seller = sellerScope;

  router.get('/', validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listSellerReturns(seller(req), req.query);
    return sendData(res, data, { meta });
  }));
  router.get('/:id', validate({ params: idParams }), route(async (req, res) => sendData(res, await getSellerReturn(seller(req), req.params.id))));
  router.post('/:id/approve', validate({ params: idParams }), route(async (req, res) => sendData(res, await approveReturn(seller(req), req.params.id, req.auth))));
  router.post('/:id/schedule-pickup', validate({ params: idParams }), route(async (req, res) => sendData(res, await schedulePickupFor(seller(req), req.params.id))));
  router.post('/:id/reject', validate({ params: idParams, body: rejectBody }), route(async (req, res) => sendData(res, await rejectReturn(seller(req), req.params.id, req.body, req.auth))));
  router.post('/:id/receive', validate({ params: idParams }), route(async (req, res) => sendData(res, await receiveReturn(seller(req), req.params.id, req.auth))));
  router.post('/:id/qc', validate({ params: idParams, body: qcBody }), route(async (req, res) => sendData(res, await recordReturnQc(seller(req), req.params.id, req.body, req.auth))));

  return router;
}
