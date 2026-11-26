import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError.js';
import { verifyFileToken } from '../../../shared/utils/signedUrl.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { confirmFromClient, getPayment, toPaymentDto } from '../../payment/public/index.js';
import { createIntent, createSession, getSession, previewCheckout, revalidate, setAddress, setPaymentMethod, setWallet } from '../application/checkout.service.js';
import { getCustomerInvoice, listCustomerInvoices, sendPdf } from '../application/invoice.service.js';
import { cancelReturn, createReturn, getReturn, getReturnableItems, listReturns } from '../application/return.service.js';
import { cancelOrder, createOrder, getOrder, getOrderTimeline, getShipmentTracking, listOrders } from '../application/order.service.js';

const buyNowItem = z.object({
  offerId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
  variantId: objectIdSchema.optional(),
  variantLabel: z.string().max(100).optional(), // sent by the app; the variant is chosen by variantId
  quantity: z.number().int().min(1).max(100),
}).refine((item) => item.offerId || item.productId, { message: 'Say which product to buy.' });
const sessionBody = z.object({
  source: z.enum(['CART', 'BUY_NOW']).default('CART'),
  addressId: objectIdSchema.optional(),
  cartVersion: z.number().int().nonnegative().optional(),
  items: z.array(buyNowItem).min(1).max(20).optional(),
}).strict().refine((body) => body.source !== 'BUY_NOW' || body.items, { message: 'Say what to buy.', path: ['items'] });
const sessionParams = z.object({ checkoutSessionId: objectIdSchema });
const addressBody = z.object({ addressId: objectIdSchema }).strict();
const methodBody = z.object({ paymentMethod: z.enum(['upi', 'card', 'cod']) }).strict();
const intentBody = z.object({ method: z.enum(['upi', 'card', 'cod']) }).strict();
const paymentParams = z.object({ paymentId: objectIdSchema });
const confirmBody = z.object({ razorpayPaymentId: z.string().min(1).max(64), razorpayOrderId: z.string().min(1).max(64), razorpaySignature: z.string().min(1).max(128) }).strict();
const orderBody = z.object({ checkoutSessionId: objectIdSchema, paymentId: objectIdSchema }).strict();
const invoiceParams = z.object({ invoiceId: objectIdSchema });
const orderParams = z.object({ orderId: objectIdSchema });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: objectIdSchema.optional() });
const shipmentParams = z.object({ shipmentId: objectIdSchema });
const returnParams = z.object({ returnId: objectIdSchema });
const returnBody = z.object({
  orderId: objectIdSchema,
  orderItemId: objectIdSchema,
  resolution: z.string().max(20),
  reasonCode: z.string().max(40),
  pickupAddressId: objectIdSchema,
  evidenceMediaIds: z.array(z.string().max(300)).max(10).default([]),
  refundDestination: z.string().max(30).optional(), // only the original payment is offered, so it is not read
  comment: z.string().trim().max(500).optional(),
}).strict();
const cancelBody = z.object({ reason: z.string().trim().max(100).optional(), comment: z.string().trim().max(500).optional() }).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1: checkout, payment and orders of the signed-in customer.
// The app sends PATCH for address / payment-method and the API contract names PUT: both do the same.
export function createCustomerOrderRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const me = (req) => req.auth.userId;

  router.post('/checkout/preview', ...customerOnly, validate({ body: sessionBody }), route(async (req, res) => sendData(res, await previewCheckout(me(req), req.body))));
  router.post('/checkout/sessions', ...customerOnly, validate({ body: sessionBody }), idempotent(), route(async (req, res) =>
    sendCommand(res, await createSession(me(req), req.body), { status: 201 })));
  router.get('/checkout/sessions/:checkoutSessionId', ...customerOnly, validate({ params: sessionParams }), route(async (req, res) =>
    sendData(res, await getSession(me(req), req.params.checkoutSessionId))));
  router.route('/checkout/sessions/:checkoutSessionId/address')
    .put(...customerOnly, validate({ params: sessionParams, body: addressBody }), route(async (req, res) => sendCommand(res, await setAddress(me(req), req.params.checkoutSessionId, req.body.addressId))))
    .patch(...customerOnly, validate({ params: sessionParams, body: addressBody }), route(async (req, res) => sendCommand(res, await setAddress(me(req), req.params.checkoutSessionId, req.body.addressId))));
  router.route('/checkout/sessions/:checkoutSessionId/payment-method')
    .put(...customerOnly, validate({ params: sessionParams, body: methodBody }), route(async (req, res) => sendCommand(res, await setPaymentMethod(me(req), req.params.checkoutSessionId, req.body.paymentMethod))))
    .patch(...customerOnly, validate({ params: sessionParams, body: methodBody }), route(async (req, res) => sendCommand(res, await setPaymentMethod(me(req), req.params.checkoutSessionId, req.body.paymentMethod))));
  router.put('/checkout/sessions/:checkoutSessionId/wallet', ...customerOnly, validate({ params: sessionParams, body: z.object({ use: z.boolean() }).strict() }), route(async (req, res) =>
    sendCommand(res, await setWallet(me(req), req.params.checkoutSessionId, req.body.use))));
  router.post('/checkout/sessions/:checkoutSessionId/revalidate', ...customerOnly, validate({ params: sessionParams }), route(async (req, res) =>
    sendCommand(res, await revalidate(me(req), req.params.checkoutSessionId))));
  router.post('/checkout/sessions/:checkoutSessionId/payment-intent', ...customerOnly, validate({ params: sessionParams, body: intentBody }), idempotent(), route(async (req, res) =>
    sendCommand(res, await createIntent(me(req), req.params.checkoutSessionId, req.body.method), { status: 201 })));

  router.get('/payments/:paymentId', ...customerOnly, validate({ params: paymentParams }), route(async (req, res) =>
    sendData(res, toPaymentDto(await getPayment(me(req), req.params.paymentId)))));
  router.post('/payments/:paymentId/confirm', ...customerOnly, validate({ params: paymentParams, body: confirmBody }), route(async (req, res) =>
    sendCommand(res, toPaymentDto(await confirmFromClient(me(req), req.params.paymentId, req.body)))));

  router.post('/orders', ...customerOnly, validate({ body: orderBody }), idempotent(), route(async (req, res) =>
    sendCommand(res, await createOrder(me(req), req.body), { status: 201 })));
  router.get('/orders', ...customerOnly, validate({ query: listQuery }), route(async (req, res) =>
    sendData(res, await listOrders(me(req), req.query))));
  router.get('/orders/:orderId', ...customerOnly, validate({ params: orderParams }), route(async (req, res) =>
    sendData(res, await getOrder(me(req), req.params.orderId))));
  router.get('/orders/:orderId/timeline', ...customerOnly, validate({ params: orderParams }), route(async (req, res) =>
    sendData(res, await getOrderTimeline(me(req), req.params.orderId))));
  router.post('/orders/:orderId/cancel', ...customerOnly, validate({ params: orderParams, body: cancelBody }), route(async (req, res) =>
    sendCommand(res, await cancelOrder(me(req), req.params.orderId, req.body))));

  router.get('/orders/:orderId/returnable-items', ...customerOnly, validate({ params: orderParams }), route(async (req, res) =>
    sendData(res, await getReturnableItems(me(req), req.params.orderId))));
  // No Idempotency-Key: the app does not send one here, and one open return per item is enforced by the database instead.
  router.post('/returns', ...customerOnly, validate({ body: returnBody }), route(async (req, res) =>
    sendCommand(res, await createReturn(me(req), req.body), { status: 201 })));
  router.get('/returns', ...customerOnly, validate({ query: listQuery }), route(async (req, res) =>
    sendData(res, await listReturns(me(req), req.query))));
  router.get('/returns/:returnId', ...customerOnly, validate({ params: returnParams }), route(async (req, res) =>
    sendData(res, await getReturn(me(req), req.params.returnId))));
  router.post('/returns/:returnId/cancel', ...customerOnly, validate({ params: returnParams }), route(async (req, res) =>
    sendCommand(res, await cancelReturn(me(req), req.params.returnId))));

  router.get('/orders/:orderId/invoices', ...customerOnly, validate({ params: orderParams }), route(async (req, res) =>
    sendData(res, await listCustomerInvoices(me(req), req.params.orderId))));
  router.get('/invoices/:invoiceId/pdf', ...customerOnly, validate({ params: invoiceParams }), route(async (req, res) =>
    sendPdf(res, await getCustomerInvoice(req.params.invoiceId, me(req)))));
  // Opened by a browser or the app's viewer, which cannot send a login header: the signed, short-lived token is the credential.
  router.get('/invoices/:invoiceId/file', validate({ params: invoiceParams, query: z.object({ token: z.string().max(200) }) }), route(async (req, res) => {
    if (!verifyFileToken(`invoice:${req.params.invoiceId}`, req.query.token)) throw new AppError({ code: 'LINK_EXPIRED', status: 403, message: 'This download link has expired. Open the order again to get a new one.' });
    return sendPdf(res, await getCustomerInvoice(req.params.invoiceId));
  }));

  router.get('/shipments/:shipmentId/tracking', ...customerOnly, validate({ params: shipmentParams }), route(async (req, res) =>
    sendData(res, await getShipmentTracking(me(req), req.params.shipmentId))));

  return router;
}
