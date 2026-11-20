import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { createCoupon, endCoupon, listCoupons, setCouponPaused, toSellerCoupon } from '../application/coupon.service.js';
import { COUPON_STATUS, SELLER_COUPON_BUDGET_PAISE, SELLER_COUPON_TYPES } from '../domain/constants/coupon.js';
import { couponObject, withDiscountRules } from './coupon.routes.js';

const SORTABLE = ['createdAt', 'startsAt', 'endsAt', 'totalRedemptions'];

// A seller sets the discount, limits and dates; audience, stacking, visibility, funding and budget are fixed for them.
const createSchema = withDiscountRules(
  couponObject
    .pick({ name: true, valuePct: true, valuePaise: true, maxDiscountPaise: true, minCartPaise: true, totalLimit: true, perUserLimit: true, startsAt: true, endsAt: true })
    .extend({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Use 3–20 letters or digits.'),
      type: z.enum(SELLER_COUPON_TYPES),
      description: z.string().trim().max(200).default(''),
    })
    .strict(),
);
const idParams = z.object({ id: objectIdSchema });
const listQuery = pageQuery
  .extend({ status: csvQuery(Object.values(COUPON_STATUS)) })
  .transform((query) => ({ ...query, ...parseSort(query.sort || '-createdAt', SORTABLE, 'createdAt') }));

const actorOf = (req) => ({ userId: req.auth.userId, role: req.auth.role, sellerId: req.auth.sellerId });

// Mount path: /api/seller/v1/coupons — the seller's own discount codes (they fund them; they apply to their items only).
// Every read and write is scoped by the sellerId in the token; another seller's coupon is simply "not found".
export function createSellerCouponRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listCoupons({ ...req.query, type: [], sellerId: sellerScope(req) });
    return sendData(res, data.map(toSellerCoupon), { meta });
  });
  // Changes cost the seller money, so they belong to the account owner, not staff.
  router.post('/', authorize(ROLES.SELLER), validate({ body: createSchema }), async (req, res) => {
    const sellerId = sellerScope(req);
    const input = { ...req.body, sellerId, fundedBy: 'SELLER', audience: { type: 'ALL' }, stackable: false, visibility: 'PUBLIC', terms: '', budgetPaise: SELLER_COUPON_BUDGET_PAISE };
    return sendCommand(res, toSellerCoupon(await createCoupon(input, actorOf(req))), { status: 201 });
  });
  router.post('/:id/pause', authorize(ROLES.SELLER), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, toSellerCoupon(await setCouponPaused(req.params.id, true, actorOf(req), sellerScope(req)))),
  );
  router.post('/:id/resume', authorize(ROLES.SELLER), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, toSellerCoupon(await setCouponPaused(req.params.id, false, actorOf(req), sellerScope(req)))),
  );
  router.post('/:id/end', authorize(ROLES.SELLER), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, toSellerCoupon(await endCoupon(req.params.id, actorOf(req), sellerScope(req)))),
  );

  return router;
}
