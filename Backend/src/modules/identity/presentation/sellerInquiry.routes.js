import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { emailSchema, objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { createSellerInquiry, getSellerInquiry, listSellerInquiries, sendSellerInquiryInvite } from '../application/sellerInquiry.service.js';

export const sellerInquiryBody = z.object({
  businessName: z.string().trim().min(2).max(120),
  email: emailSchema,
  gstin: z.string().trim().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/),
  mobile: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/),
  pickupPincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  consentVersion: z.string().trim().min(1).max(50),
}).strict();

const listQuery = pageQuery.extend({ q: z.string().trim().max(100).optional() });
const route = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

export function createCustomerSellerInquiryRouter() {
  const router = Router();
  router.get(
    '/seller-leads/me',
    authenticate,
    authorize(ROLES.CUSTOMER),
    route(async (req, res) => sendData(res, await getSellerInquiry(req.auth.userId))),
  );
  router.post(
    '/seller-leads',
    authenticate,
    authorize(ROLES.CUSTOMER),
    validate({ body: sellerInquiryBody }),
    idempotent(),
    route(async (req, res) => sendData(res, await createSellerInquiry(req.auth.userId, req.body), { status: 201 })),
  );
  return router;
}

export function createAdminSellerInquiryRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get(
    '/',
    requirePermission('sellers.application.view'),
    validate({ query: listQuery }),
    route(async (req, res) => {
      const { rows, total } = await listSellerInquiries(req.query);
      return sendData(res, rows, { meta: { total } });
    }),
  );
  router.post(
    '/:id/invite',
    requirePermission('sellers.application.request_info'),
    validate({ params: z.object({ id: objectIdSchema }) }),
    route(async (req, res) => sendData(res, await sendSellerInquiryInvite(req.params.id, {
      userId: req.auth.userId,
      role: req.auth.role,
    }))),
  );
  return router;
}
