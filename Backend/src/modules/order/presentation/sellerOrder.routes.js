import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { csvQuery, objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { STAGES, SUB } from '../domain/services/orderStatus.js';
import { getSellerInvoice, getSellerInvoices, sendPdf } from '../application/invoice.service.js';
import { bulkSellerAction, cancelSubOrder, confirmSubOrder, getSellerOrder, listSellerOrders, matchingParcelIds, mockReadyToShipSubOrder, readyToShipSubOrder } from '../application/sellerOrder.service.js';

const listQuery = pageQuery.extend({
  sort: z.string().default('-placedAt'),
  stage: z.enum(['all', ...Object.keys(STAGES)]).optional().transform((stage) => (stage === 'all' ? undefined : stage)),
  status: csvQuery(Object.values(SUB)),
});
const idParams = z.object({ id: objectIdSchema });
const printBody = z.object({ ids: z.array(objectIdSchema).min(1).max(100) }).strict();
const cancelBody = z.object({ reason: z.string().trim().max(200).optional() }).strict();
const bulkBody = z.object({
  action: z.enum(['confirm', 'ready-to-ship']),
  selection: z.union([
    z.object({ mode: z.literal('SELECTED'), ids: z.array(objectIdSchema).min(1).max(200) }),
    z.object({ mode: z.literal('FILTERED'), filters: z.object({ tab: z.string().max(20).optional(), status: z.string().max(200).optional(), q: z.string().max(100).optional() }).passthrough() }),
  ]),
}).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/orders: the seller's parcels (their part of each customer order), in the shape the seller panel reads.
export function createSellerOrderRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/', validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listSellerOrders(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/bulk', validate({ body: bulkBody }), route(async (req, res) => {
    const sellerId = sellerScope(req);
    const { action, selection } = req.body;
    const ids = selection.mode === 'SELECTED' ? selection.ids : await matchingParcelIds(sellerId, selection.filters);
    return sendData(res, await bulkSellerAction(sellerId, action, ids, req.auth));
  }));
  router.get('/:id', validate({ params: idParams }), route(async (req, res) => sendData(res, await getSellerOrder(sellerScope(req), req.params.id))));
  router.post('/invoices/print', validate({ body: printBody }), route(async (req, res) => sendPdf(res, await getSellerInvoices(sellerScope(req), req.body.ids))));
  router.get('/:id/invoice', validate({ params: idParams }), route(async (req, res) => sendPdf(res, await getSellerInvoice(sellerScope(req), { subOrderId: req.params.id }))));
  // The panel's document centre asks for a tax invoice here; it already exists once the parcel is ready to ship (nothing is generated on demand).
  router.post('/:id/documents/:type', validate({ params: idParams.extend({ type: z.enum(['TAX_INVOICE', 'PACKING_SLIP', 'SHIPPING_LABEL', 'MANIFEST']) }) }), route(async (req, res) => {
    if (req.params.type !== 'TAX_INVOICE') throw new AppError({ code: 'DOCUMENT_NOT_READY', status: 409, message: 'That document is not available yet.' });
    await getSellerInvoice(sellerScope(req), { subOrderId: req.params.id });
    return sendData(res, (await getSellerOrder(sellerScope(req), req.params.id)).documents);
  }));
  router.get('/:id/documents', validate({ params: idParams }), route(async (req, res) => sendData(res, (await getSellerOrder(sellerScope(req), req.params.id)).documents)));
  router.post('/:id/confirm', validate({ params: idParams }), route(async (req, res) => sendData(res, await confirmSubOrder(sellerScope(req), req.params.id, req.auth))));
  router.post('/:id/ready-to-ship', validate({ params: idParams }), route(async (req, res) => sendData(res, await readyToShipSubOrder(sellerScope(req), req.params.id, req.auth))));
  router.post('/:id/mock-ready-to-ship', validate({ params: idParams }), route(async (req, res) => sendData(res, await mockReadyToShipSubOrder(sellerScope(req), req.params.id, req.auth))));
  router.post('/:id/cancel', validate({ params: idParams, body: cancelBody }), route(async (req, res) => sendData(res, await cancelSubOrder(sellerScope(req), req.params.id, req.body.reason, req.auth))));

  return router;
}
