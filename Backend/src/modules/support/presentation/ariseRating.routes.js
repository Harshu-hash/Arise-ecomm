import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { pageQuery } from '../../../shared/validators/common.js';
import { listAriseRatings, rateArise } from '../application/ariseRating.service.js';

export const ariseRatingBody = z.object({ rating: z.number().int().min(1).max(5) }).strict();
const listQuery = pageQuery.extend({ rating: z.coerce.number().int().min(1).max(5).optional() });
const route = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

export function createCustomerAriseRatingRouter() {
  const router = Router();
  router.put(
    '/arise-ratings',
    authenticate,
    authorize(ROLES.CUSTOMER),
    validate({ body: ariseRatingBody }),
    route(async (req, res) => sendData(res, await rateArise(req.auth.userId, req.body.rating))),
  );
  return router;
}

export function createAdminAriseRatingRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN), requirePermission('support.csat.view'));
  router.get('/', validate({ query: listQuery }), route(async (req, res) => {
    const { rows, total } = await listAriseRatings(req.query);
    return sendData(res, rows, { meta: { total } });
  }));
  return router;
}
