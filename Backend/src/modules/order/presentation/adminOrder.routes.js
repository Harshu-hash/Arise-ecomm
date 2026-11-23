import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission, userHasPermission } from '../../../shared/middleware/permission.js';
import { grantedReturnPermissions } from './adminReturn.routes.js';
import { raiseReturn } from '../application/adminReturn.service.js';
import { getAdminOrder, listAdminOrders, PARCEL_STATUSES, setParcelStatus } from '../application/adminOrder.service.js';

const text = z.string().trim().max(100);
// The console sends date ranges as `placedAt[gte]=...&placedAt[lte]=...`; anything it sends that is not listed is ignored.
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(40).default('-placedAt'),
  q: text.optional(),
  status: z.string().max(300).optional(),
  paymentMethod: z.string().max(100).optional(),
  sellerId: z.string().max(40).optional(),
  state: text.optional(),
  city: text.optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  couponCode: text.optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
  'placedAt[gte]': z.string().max(40).optional(),
  'placedAt[lte]': z.string().max(40).optional(),
}).passthrough();
const idParams = z.object({ id: z.string().trim().min(1).max(40) });
const parcelParams = idParams.extend({ parcelId: z.string().regex(/^[a-f\d]{24}$/i) });
const returnBody = z.object({ reason: z.string().trim().min(1).max(100), type: z.enum(['REFUND', 'REPLACEMENT']).optional(), comments: z.string().trim().max(500).optional() }).strict();
const statusBody = z.object({ status: z.enum(PARCEL_STATUSES), reason: z.string().trim().min(3, 'Say why you are changing this status.').max(300) }).strict();

// Mounted at /api/admin/v1/orders: every order across all sellers, read-only for now.
export function createAdminOrderRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('orders.order.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listAdminOrders(req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id', requirePermission('orders.order.view'), validate({ params: idParams }), async (req, res) => {
    const { data, meta } = await getAdminOrder(req.params.id, { canOverrideStatus: await userHasPermission(req.auth.userId, 'orders.order.override_status') });
    return sendData(res, data, { meta });
  });
  router.post('/:id/parcels/:parcelId/status', requirePermission('orders.order.override_status'), validate({ params: parcelParams, body: statusBody }), async (req, res) => {
    const { data, meta } = await setParcelStatus(req.params.id, req.params.parcelId, req.body, req.auth);
    return sendData(res, data, { meta });
  });

  // an admin raises a return for the customer: refund only, so a replacement is refused
  router.post('/:id/items/:itemId/return', requirePermission('orders.item.return_initiate'), validate({ params: idParams.extend({ itemId: z.string().regex(/^[a-f\d]{24}$/i) }), body: returnBody }), async (req, res) => {
    if (req.body.type === 'REPLACEMENT') throw new AppError({ code: 'RESOLUTION_NOT_AVAILABLE', status: 409, message: 'Replacements are not available yet: only refunds.' });
    const { data, meta } = await raiseReturn(req.params.id, req.params.itemId, req.body, req.auth, await grantedReturnPermissions(req.auth.userId));
    return sendData(res, data, { meta, status: 201 });
  });

  return router;
}
