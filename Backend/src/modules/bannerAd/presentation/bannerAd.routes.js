import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import {
  createBooking,
  createSlot,
  decideBooking,
  deleteSlot,
  getPaymentOrder,
  getSellerBooking,
  listAdminRequests,
  listBookableSlots,
  listDestinations,
  listSellerBookings,
  listSlots,
  updateSlot,
  verifyBookingPayment,
} from '../application/bannerAd.service.js';
import { BOOKING_STATUS } from '../domain/bannerAdRules.js';

const idParams = z.object({ id: objectIdSchema });
const size = z.number().int().min(100).max(4000);
const slotFields = {
  name: z.string().trim().min(1, 'Give the slot a name.').max(80),
  description: z.string().trim().max(300),
  dailyRatePaise: z.number().int().min(1, 'Enter a daily price greater than zero.').max(100_000_000),
  mobileWidth: size,
  mobileHeight: size,
  categoryId: objectIdSchema.nullable(),
  enabled: z.boolean(),
};
const createSlotSchema = z.object({ ...slotFields, description: slotFields.description.default(''), enabled: slotFields.enabled.default(true), categoryId: slotFields.categoryId.default(null) }).strict();
const updateSlotSchema = z.object(Object.fromEntries(Object.entries(slotFields).map(([key, schema]) => [key, schema.optional()]))).strict();
const decideSchema = z
  .object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().max(500).optional() })
  .refine((body) => body.decision !== 'REJECTED' || body.reason, { message: 'Tell the seller why the banner was rejected.', path: ['reason'] });

const csv = (allowed) => z.string().optional().transform((value) => (value ? value.split(',').filter((item) => allowed.includes(item)) : []));
const listQuery = (sortable, fallback) =>
  pageQuery
    .extend({ status: csv(Object.values(BOOKING_STATUS)) })
    .transform((query) => ({ ...query, ...parseSort(query.sort, sortable, fallback) }))
    .transform((query) => ({ ...query, sortDirection: query.sort ? query.sortDirection : -1 })); // newest first unless asked

const creative = z.object({ mediaId: objectIdSchema });
const bookingSchema = z.object({
  campaignName: z.string().trim().min(1, 'Name this campaign.').max(80),
  placementId: objectIdSchema,
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  destinationType: z.enum(['SHOP', 'PRODUCT']),
  destinationValue: z.string().trim().min(1).max(64),
  mobileCreative: creative,
});
const payBody = z.object({ providerPaymentId: z.string().trim().min(1).max(64), signature: z.string().trim().min(1).max(128) }).strict();

// Mount path: /api/admin/v1/banner-ads
export function createBannerAdAdminRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/placements', requirePermission('ads.placement.view'), async (_req, res) => sendData(res, await listSlots()));
  router.post('/placements', requirePermission('ads.placement.edit'), validate({ body: createSlotSchema }), async (req, res) =>
    sendCommand(res, await createSlot(req.body, req.auth), { status: 201 }),
  );
  router.patch('/placements/:id', requirePermission('ads.placement.edit'), validate({ params: idParams, body: updateSlotSchema }), async (req, res) =>
    sendCommand(res, await updateSlot(req.params.id, req.body, req.auth)),
  );
  router.delete('/placements/:id', requirePermission('ads.placement.edit'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await deleteSlot(req.params.id, req.auth)),
  );

  router.get('/requests', requirePermission('ads.review.view'), validate({ query: listQuery(['submittedAt', 'totalPaise', 'startsOn'], 'submittedAt') }), async (req, res) => {
    const { data, meta } = await listAdminRequests(req.query);
    return sendData(res, data, { meta });
  });
  router.post('/requests/:id/decide', requirePermission('ads.review.decide'), validate({ params: idParams, body: decideSchema }), async (req, res) =>
    sendCommand(res, await decideBooking(req.params.id, req.body, req.auth)),
  );

  return router;
}

// Mount path: /api/seller/v1/banner-ads
export function createBannerAdSellerRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/placements', async (_req, res) => sendData(res, await listBookableSlots()));
  router.get('/destinations', async (req, res) => sendData(res, await listDestinations(sellerScope(req))));

  router.get('/', validate({ query: listQuery(['createdAt', 'totalPaise', 'startsOn'], 'createdAt') }), async (req, res) => {
    const { data, meta } = await listSellerBookings(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id/payment-order', validate({ params: idParams }), async (req, res) => sendData(res, await getPaymentOrder(sellerScope(req), req.params.id)));
  router.get('/:id', validate({ params: idParams }), async (req, res) => sendData(res, await getSellerBooking(sellerScope(req), req.params.id)));

  // Holds the dates and returns the Razorpay order to pay; POST /:id/pay confirms it.
  router.post('/', validate({ body: bookingSchema }), idempotent(), async (req, res) =>
    sendCommand(res, await createBooking(sellerScope(req), req.body, req.auth), { status: 201 }),
  );
  router.post('/:id/pay', validate({ params: idParams, body: payBody }), async (req, res) =>
    sendCommand(res, await verifyBookingPayment(sellerScope(req), req.params.id, req.body)),
  );

  return router;
}
