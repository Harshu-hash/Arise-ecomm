import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { addToWishlist, listWishlist, moveWishlistItemToCart, removeFromWishlist } from '../application/wishlist.service.js';

const itemBody = z.object({ productId: objectIdSchema }).strict();
const itemParams = z.object({ productId: objectIdSchema });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1 — the signed-in customer's saved products.
export function createCustomerWishlistRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];

  router.get('/wishlist', ...customerOnly, route(async (req, res) => sendData(res, await listWishlist(req.auth.userId))));
  router.post('/wishlist/items', ...customerOnly, validate({ body: itemBody }), route(async (req, res) =>
    sendCommand(res, await addToWishlist(req.auth.userId, req.body.productId), { status: 201 })));
  router.delete('/wishlist/items/:productId', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendCommand(res, await removeFromWishlist(req.auth.userId, req.params.productId))));

  router.post('/wishlist/:productId/move-to-cart', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendCommand(res, await moveWishlistItemToCart(req.auth.userId, req.params.productId))));

  return router;
}
