import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { markCodRemitted } from '../application/settlementAccrual.service.js';
import { getLine, listLines, platformSummary } from '../application/settlementQuery.service.js';
import { adjustWallet, listLedger, setPayoutHold, walletView } from '../application/wallet.service.js';
import { approveWithdrawal, getWithdrawal, listWithdrawals, payWithdrawal, rejectWithdrawal } from '../application/withdrawal.service.js';

const idParams = z.object({ id: objectIdSchema });
const sellerParams = z.object({ sellerId: objectIdSchema });
const lineQuery = pageQuery.extend({ state: z.enum(['PENDING', 'HELD', 'AVAILABLE', 'REVERSED']).optional(), paymentMethod: z.string().max(10).optional(), sellerId: objectIdSchema.optional() });
const withdrawalQuery = pageQuery.extend({ status: z.string().max(80).optional(), sellerId: objectIdSchema.optional() });
const ledgerQuery = pageQuery.extend({ type: z.string().max(30).optional() });
const reasonBody = z.object({ reason: z.string().trim().min(3, 'Tell the seller why.').max(500) });
const payBody = z.object({ txnNo: z.string().trim().min(4, 'Enter the bank / UPI transaction number.').max(60), utr: z.string().trim().max(40).default('') });
const codBody = z.object({ lineIds: z.array(objectIdSchema).min(1).max(500) });
const adjustBody = z.object({ amountPaise: z.number().int().refine((n) => n !== 0, 'Enter an amount other than zero.'), reason: z.string().trim().min(3, 'A reason is required.').max(500) });
const holdBody = z.object({ onHold: z.boolean(), reason: z.string().trim().min(3, 'A reason is required.').max(500) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};
const adminOnly = (router) => router.use(authenticate, authorize(ROLES.ADMIN));

// Mounted at /api/admin/v1/settlements: every delivered item across sellers and where its money stands.
export function createAdminSettlementRouter() {
  const router = Router();
  adminOnly(router);
  router.get('/summary', requirePermission('finance.payout.view'), route(async (_req, res) => sendData(res, await platformSummary())));
  router.get('/', requirePermission('finance.payout.view'), validate({ query: lineQuery }), route(async (req, res) => {
    const { data, meta } = await listLines(req.query);
    return sendData(res, data, { meta });
  }));
  // the courier's cash for these cash-on-delivery items reached Arise: they may now be released to sellers
  router.post('/cod-remitted', requirePermission('finance.payout.release'), validate({ body: codBody }), route(async (req, res) => sendData(res, { marked: await markCodRemitted(req.body.lineIds) })));
  router.get('/:id', requirePermission('finance.payout.view'), validate({ params: idParams }), route(async (req, res) => sendData(res, await getLine(req.params.id))));
  return router;
}

// Mounted at /api/admin/v1/withdrawals: the queue of seller withdrawal requests. Every one is approved by hand, then paid.
export function createAdminWithdrawalRouter() {
  const router = Router();
  adminOnly(router);
  router.get('/', requirePermission('finance.payout.view'), validate({ query: withdrawalQuery }), route(async (req, res) => {
    const { data, meta } = await listWithdrawals(req.query, { admin: true });
    return sendData(res, data, { meta });
  }));
  router.get('/:id', requirePermission('finance.payout.view'), validate({ params: idParams }), route(async (req, res) => sendData(res, await getWithdrawal(req.params.id, { admin: true }))));
  router.post('/:id/approve', requirePermission('finance.payout.approve'), validate({ params: idParams }), route(async (req, res) => sendData(res, await approveWithdrawal(req.params.id, req.auth))));
  router.post('/:id/reject', requirePermission('finance.payout.approve'), validate({ params: idParams, body: reasonBody }), route(async (req, res) => sendData(res, await rejectWithdrawal(req.params.id, req.body, req.auth))));
  router.post('/:id/pay', requirePermission('finance.payout.release'), validate({ params: idParams, body: payBody }), route(async (req, res) => sendData(res, await payWithdrawal(req.params.id, req.body, req.auth))));
  return router;
}

// Mounted at /api/admin/v1/seller-wallets: one seller's wallet, ledger, manual adjustments and payout hold.
export function createAdminWalletRouter() {
  const router = Router();
  adminOnly(router);
  router.get('/:sellerId', requirePermission('finance.payout.view'), validate({ params: sellerParams }), route(async (req, res) => sendData(res, await walletView(req.params.sellerId))));
  router.get('/:sellerId/transactions', requirePermission('finance.payout.view'), validate({ params: sellerParams, query: ledgerQuery }), route(async (req, res) => {
    const { data, meta } = await listLedger(req.params.sellerId, req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/:sellerId/adjustments', requirePermission('finance.payout.adjust'), validate({ params: sellerParams, body: adjustBody }), route(async (req, res) => sendData(res, await adjustWallet(req.params.sellerId, req.body, req.auth))));
  router.post('/:sellerId/payout-hold', requirePermission('finance.payout.hold'), validate({ params: sellerParams, body: holdBody }), route(async (req, res) => sendData(res, await setPayoutHold(req.params.sellerId, { on: req.body.onHold, reason: req.body.reason }, req.auth))));
  return router;
}

// Mounted at /api/admin/v1/sellers: the console's seller screens call the payout hold from the seller's own path.
export function createAdminPayoutHoldRouter() {
  const router = Router();
  router.post('/:sellerId/payout-hold', authenticate, authorize(ROLES.ADMIN), requirePermission('finance.payout.hold'), validate({ params: sellerParams, body: holdBody }), route(async (req, res) => sendData(res, await setPayoutHold(req.params.sellerId, { on: req.body.onHold, reason: req.body.reason }, req.auth))));
  return router;
}
