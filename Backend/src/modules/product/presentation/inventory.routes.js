import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { booleanQuery, objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { getStockLedger, listSellerInventory, setSellerStock } from '../application/inventory.service.js';

const MAX_STOCK = 1_000_000;
const listQuery = pageQuery.extend({
  sort: z.string().default('-sellable'),
  fulfillmentType: z.enum(['SELLER', 'ARISE']).optional(),
  lowStock: booleanQuery.optional(),
  aged: booleanQuery.optional(),
});
const idParams = z.object({ id: objectIdSchema });
const stockBody = z.object({
  sellable: z.number().int('Stock must be a whole number.').min(0, 'Stock cannot be negative.').max(MAX_STOCK),
  version: z.number().int().min(1),
  note: z.string().trim().min(1, 'Add a note for the stock ledger.').max(200),
  reference: z.string().trim().max(100).optional(),
}).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/inventory — the seller's stock, one row per offer (variant).
export function createInventoryRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/', validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listSellerInventory(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  }));
  // Restock suggestions need sales velocity, which needs orders; until those exist there is nothing to suggest.
  router.get('/recommendations', route(async (req, res) => {
    sellerScope(req);
    return sendData(res, []);
  }));
  router.get('/:id/ledger', validate({ params: idParams }), route(async (req, res) =>
    sendData(res, await getStockLedger(sellerScope(req), req.params.id))));
  router.patch('/:id/stock', validate({ params: idParams, body: stockBody }), idempotent(), route(async (req, res) =>
    sendData(res, await setSellerStock(sellerScope(req), req.params.id, req.body, req.auth))));

  return router;
}
