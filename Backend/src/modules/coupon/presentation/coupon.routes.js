import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { cloneCoupon, createCoupon, endCoupon, getCoupon, listCoupons, testCoupon, togglePauseCoupon, updateCoupon } from '../application/coupon.service.js';
import {
  AUDIENCE_TYPES,
  COUPON_FUNDERS,
  COUPON_STATUS,
  COUPON_TYPES,
  COUPON_VISIBILITY,
  MAX_CUSTOM_AUDIENCE,
} from '../domain/constants/coupon.js';

const SORTABLE = ['createdAt', 'startsAt', 'endsAt', 'totalRedemptions', 'budgetBurnPct'];
const MAX_AMOUNT_PAISE = 1_000_000_000; // ₹1 crore

export const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL') }),
  z.object({ type: z.literal('NEW') }),
  z.object({ type: z.literal('CUSTOM'), customerIds: z.array(objectIdSchema).min(1, 'Choose at least one customer.').max(MAX_CUSTOM_AUDIENCE) }),
]);

const paise = (min) => z.number().int().min(min).max(MAX_AMOUNT_PAISE);
const fields = {
  name: z.string().trim().min(1, 'Give the coupon a name customers will see.').max(80),
  description: z.string().trim().max(300),
  terms: z.string().trim().max(1000),
  valuePct: z.number().int('Use a whole percentage.').min(1).max(100),
  valuePaise: paise(100),
  maxDiscountPaise: paise(100).nullable(),
  buyQty: z.number().int().min(1).max(10),
  getQty: z.number().int().min(1).max(10),
  minCartPaise: paise(0),
  audience: audienceSchema,
  stackable: z.boolean(),
  visibility: z.enum(COUPON_VISIBILITY),
  totalLimit: z.number().int().min(1).max(10_000_000),
  perUserLimit: z.number().int().min(1).max(1000),
  budgetPaise: paise(100),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};

// Which discount fields each type needs; fields that belong to another type are cleared rather than rejected,
// because the form can still hold values from a type the admin switched away from.
const TYPE_FIELDS = { PERCENT: ['valuePct'], FLAT: ['valuePaise'], BXGY: ['buyQty', 'getQty'], FREE_DELIVERY: [] };
const DISCOUNT_FIELDS = ['valuePct', 'valuePaise', 'maxDiscountPaise', 'buyQty', 'getQty'];

/** Adds the per-type discount rules (required value, other types' fields cleared) to any coupon create schema. */
export const withDiscountRules = (schema) =>
  schema
    .superRefine((value, ctx) => {
      for (const field of TYPE_FIELDS[value.type]) {
        if (value[field] === undefined) ctx.addIssue({ code: 'custom', path: [field], message: 'Required for this discount type.' });
      }
    })
    .transform((value) => {
      const needed = new Set([...TYPE_FIELDS[value.type], ...(value.type === 'PERCENT' ? ['maxDiscountPaise'] : [])]);
      const cleared = Object.fromEntries(DISCOUNT_FIELDS.filter((field) => !needed.has(field)).map((field) => [field, null]));
      return { ...value, maxDiscountPaise: value.maxDiscountPaise ?? null, ...cleared };
    });

export const couponObject = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, 'Use 3–20 letters, numbers, - or _.'),
  type: z.enum(COUPON_TYPES),
  fundedBy: z.enum(COUPON_FUNDERS).default('ARISE'),
  ...fields,
  valuePct: fields.valuePct.optional(),
  valuePaise: fields.valuePaise.optional(),
  buyQty: fields.buyQty.optional(),
  getQty: fields.getQty.optional(),
  maxDiscountPaise: fields.maxDiscountPaise.optional(),
  description: fields.description.default(''),
  terms: fields.terms.default(''),
  minCartPaise: fields.minCartPaise.default(0),
  audience: fields.audience.default({ type: 'ALL' }),
  stackable: fields.stackable.default(false),
  visibility: fields.visibility.default('PUBLIC'),
});

export const couponCreateSchema = withDiscountRules(couponObject.strict());

// Edits send the whole form; unknown keys (code, type — fixed after creation) are ignored, and the service decides what is editable.
const updateSchema = z.object(fields).partial();

const idParams = z.object({ id: objectIdSchema });
const testBody = z.object({ customerId: objectIdSchema, productIds: z.array(objectIdSchema).min(1, 'Add at least one product.').max(50) });
const listQuery = pageQuery
  .extend({ type: csvQuery(COUPON_TYPES), status: csvQuery(Object.values(COUPON_STATUS)), fundedBy: z.enum(COUPON_FUNDERS).optional() })
  .transform((query) => ({ ...query, ...parseSort(query.sort || '-createdAt', SORTABLE, 'createdAt') }));

// Mount path: /api/admin/v1/coupons. Status is derived from state, schedule and usage — never set by hand.
export function createCouponRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('marketing.coupon.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listCoupons(req.query);
    return sendData(res, data, { meta });
  });
  router.post('/', requirePermission('marketing.coupon.create'), validate({ body: couponCreateSchema }), async (req, res) =>
    sendCommand(res, await createCoupon(req.body, req.auth), { status: 201 }),
  );
  router.get('/:id', requirePermission('marketing.coupon.view'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await getCoupon(req.params.id)),
  );
  router.patch('/:id', requirePermission('marketing.coupon.edit'), validate({ params: idParams, body: updateSchema }), async (req, res) =>
    sendCommand(res, await updateCoupon(req.params.id, req.body, req.auth)),
  );
  router.post('/:id/pause', requirePermission('marketing.coupon.pause'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await togglePauseCoupon(req.params.id, req.auth)),
  );
  router.post('/:id/end', requirePermission('marketing.coupon.pause'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await endCoupon(req.params.id, req.auth)),
  );
  router.post('/:id/clone', requirePermission('marketing.coupon.create'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await cloneCoupon(req.params.id, req.auth), { status: 201 }),
  );
  router.post('/:id/test', requirePermission('marketing.coupon.view'), validate({ params: idParams, body: testBody }), async (req, res) =>
    sendCommand(res, await testCoupon(req.params.id, req.body)),
  );

  return router;
}
