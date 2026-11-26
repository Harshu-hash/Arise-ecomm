import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { decideReferral, getCustomerReferrals, getMyReferral, listReferrals } from '../application/referral.service.js';
import { REFERRAL_STATUS } from '../infrastructure/persistence/referral.models.js';

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mount path: /api/customer/v1/referrals
export function createCustomerReferralRouter() {
  const router = Router();
  router.get('/me', authenticate, authorize(ROLES.CUSTOMER), route(async (req, res) => sendData(res, await getMyReferral(req.auth.userId))));
  return router;
}

const listQuery = z.object({
  status: z.enum(Object.values(REFERRAL_STATUS)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const idParams = z.object({ id: objectIdSchema });
const decideBody = z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().min(1).max(300).optional() })
  .strict()
  .refine((body) => body.decision !== 'REJECT' || body.reason, { message: 'Say why it is rejected.', path: ['reason'] });

// Mount path: /api/admin/v1/referrals. The program's settings live in the 'referral' settings section, edited on the Settings page.
export function createAdminReferralRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/config', requirePermission('marketing.referral.view'), route(async (_req, res) => sendData(res, await getSettingsSection('referral'))));
  router.get('/customer/:id', requirePermission('marketing.referral.view'), validate({ params: idParams }), route(async (req, res) => sendData(res, await getCustomerReferrals(req.params.id))));
  router.get('/', requirePermission('marketing.referral.view'), validate({ query: listQuery }), route(async (req, res) => sendData(res, await listReferrals(req.query))));
  router.post('/:id/decision', requirePermission('marketing.referral.decide'), validate({ params: idParams, body: decideBody }), route(async (req, res) =>
    sendCommand(res, await decideReferral(req.params.id, req.body, req.auth))));
  return router;
}
