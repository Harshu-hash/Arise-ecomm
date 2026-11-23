import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { addItem, applyCoupon, getCart, listEligibleCoupons, moveToCart, removeCoupon, removeItem, saveForLater, setQuantity } from '../application/cart.service.js';

// The real limit per item is the platform's max per order and the stock left, checked on every change; this only bounds the input.
const quantity = z.number().int('Quantity must be a whole number.').min(1, 'Choose at least 1.').max(100);
const addBody = z.object({
  offerId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
  variantId: objectIdSchema.optional(),
  quantity,
}).strict().refine((body) => body.offerId || body.productId, { message: 'Say which product to add.' })
  .refine((body) => !body.variantId || body.productId, { message: 'A variant needs its product.' });
const quantityBody = z.object({ quantity }).strict();
const couponBody = z.object({ code: z.string().trim().min(1, 'Enter a coupon code.').max(40) }).strict();
const itemParams = z.object({ cartItemId: objectIdSchema });
const eligibleQuery = z.object({ cartId: z.string().max(100).optional() }).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1 — the signed-in customer's cart. Every response is the whole cart, priced fresh.
export function createCustomerCartRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const me = (req) => req.auth.userId;

  router.get('/cart', ...customerOnly, route(async (req, res) => sendData(res, await getCart(me(req)))));
  router.post('/cart/items', ...customerOnly, validate({ body: addBody }), route(async (req, res) =>
    sendCommand(res, (await addItem(me(req), req.body)).view, { status: 201 })));
  router.patch('/cart/items/:cartItemId', ...customerOnly, validate({ params: itemParams, body: quantityBody }), route(async (req, res) =>
    sendCommand(res, (await setQuantity(me(req), req.params.cartItemId, req.body.quantity)).view)));
  router.delete('/cart/items/:cartItemId', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendCommand(res, (await removeItem(me(req), req.params.cartItemId)).view)));
  router.post('/cart/items/:cartItemId/save-for-later', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendCommand(res, (await saveForLater(me(req), req.params.cartItemId)).view)));
  router.post('/cart/saved/:cartItemId/move-to-cart', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendCommand(res, (await moveToCart(me(req), req.params.cartItemId)).view)));
  // POST is what the app sends; PUT is what the API contract names. Both set the one coupon.
  router.route('/cart/coupon')
    .all(...customerOnly)
    .post(validate({ body: couponBody }), route(async (req, res) => sendCommand(res, (await applyCoupon(me(req), req.body.code)).view)))
    .put(validate({ body: couponBody }), route(async (req, res) => sendCommand(res, (await applyCoupon(me(req), req.body.code)).view)))
    .delete(route(async (req, res) => sendCommand(res, (await removeCoupon(me(req))).view)));
  router.get('/coupons/eligible', ...customerOnly, validate({ query: eligibleQuery }), route(async (req, res) =>
    sendData(res, { items: await listEligibleCoupons(me(req)) })));

  return router;
}
