import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { createDeletionRequest, getDeletionEligibility } from '../application/privacy.service.js';
import { DELETION_REASONS } from '../infrastructure/persistence/accountDeletion.model.js';

const requestBody = z.object({
  reasonCode: z.enum(DELETION_REASONS),
  acknowledged: z.literal(true, { error: 'Confirm that you understand account deletion is permanent.' }),
}).strict();
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

export function createCustomerPrivacyRouter() {
  const router = Router();
  router.get('/privacy/deletion-eligibility', ...customerOnly, route(async (req, res) =>
    sendData(res, await getDeletionEligibility(req.auth.userId))));
  router.post('/privacy/deletion-request', ...customerOnly, validate({ body: requestBody }), route(async (req, res) =>
    sendCommand(res, await createDeletionRequest(req.auth.userId, req.body), { status: 202 })));
  return router;
}
