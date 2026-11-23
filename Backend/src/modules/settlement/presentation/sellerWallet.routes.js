import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { getLine, listLines } from '../application/settlementQuery.service.js';
import { listLedger, walletView } from '../application/wallet.service.js';
import { cancelWithdrawal, getWithdrawal, listWithdrawals, requestWithdrawal } from '../application/withdrawal.service.js';

const idParams = z.object({ id: objectIdSchema });
const lineQuery = pageQuery.extend({ state: z.enum(['PENDING', 'HELD', 'AVAILABLE', 'REVERSED']).optional(), paymentMethod: z.string().max(10).optional() });
const ledgerQuery = pageQuery.extend({ type: z.string().max(30).optional() });
const withdrawalQuery = pageQuery.extend({ status: z.string().max(80).optional() });
const requestBody = z.object({ amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/finance: the seller's wallet, its ledger and their withdrawals. Reading is open to the seller's staff;
// moving money is the owner's alone. The seller id always comes from the signed-in account.
export function createSellerWalletRouter() {
  const router = Router();
  const readers = [authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF)];
  const owner = [authenticate, authorize(ROLES.SELLER)];

  router.get('/wallet', ...readers, route(async (req, res) => sendData(res, await walletView(sellerScope(req)))));
  router.get('/wallet/transactions', ...readers, validate({ query: ledgerQuery }), route(async (req, res) => {
    const { data, meta } = await listLedger(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  }));
  router.get('/withdrawals', ...readers, validate({ query: withdrawalQuery }), route(async (req, res) => {
    const { data, meta } = await listWithdrawals({ ...req.query, sellerId: sellerScope(req) });
    return sendData(res, data, { meta });
  }));
  router.get('/withdrawals/:id', ...readers, validate({ params: idParams }), route(async (req, res) => sendData(res, await getWithdrawal(req.params.id, { sellerId: sellerScope(req) }))));
  router.post('/withdrawals', ...owner, validate({ body: requestBody }), idempotent(), route(async (req, res) =>
    sendCommand(res, await requestWithdrawal(sellerScope(req), req.body, req.auth), { status: 201 })));
  router.post('/withdrawals/:id/cancel', ...owner, validate({ params: idParams }), route(async (req, res) =>
    sendCommand(res, await cancelWithdrawal(sellerScope(req), req.params.id, req.auth))));
  return router;
}

// Mounted at /api/seller/v1/settlements: each delivered item and where its money stands (read only).
export function createSellerSettlementRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));
  router.get('/mine', validate({ query: lineQuery }), route(async (req, res) => {
    const { data, meta } = await listLines({ ...req.query, sellerId: sellerScope(req) });
    return sendData(res, data, { meta });
  }));
  router.get('/:id', validate({ params: idParams }), route(async (req, res) => sendData(res, await getLine(req.params.id, { sellerId: sellerScope(req) }))));
  return router;
}
