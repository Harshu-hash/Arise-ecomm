import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { overLimit } from '../../../shared/middleware/scope.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { registerApprovalAction, requestApproval } from '../../approval/public/index.js';
import { adjustCustomerWallet, adminWalletView, freezeCustomerWallet } from '../application/adminWallet.service.js';
import { createCashbackRule, listCashbackRules, togglePauseCashbackRule, updateCashbackRule } from '../application/cashback.service.js';
import { blockGiftCard, generateGiftCards, listGiftCards } from '../application/giftCard.service.js';
import { GIFT_CARD_STATUS } from '../infrastructure/persistence/giftCard.model.js';

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};
const idParams = z.object({ id: objectIdSchema });
const ledgerQuery = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(20) });
const adjustBody = z.object({
  amountPaise: z.number().int().min(-10_000_000).max(10_000_000).refine((n) => n !== 0, 'Enter an amount other than zero.'),
  reason: z.string().trim().min(3, 'A reason is required.').max(500),
}).strict();
const freezeBody = z.object({ frozen: z.boolean(), reason: z.string().trim().min(3, 'A reason is required.').max(300) }).strict();
const MAX_BATCH = 500;
const generateBody = z.object({
  count: z.number().int().min(1).max(MAX_BATCH),
  amountPaise: z.number().int().min(100).max(10_000_000),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), 'Pick a date in the future.'),
  note: z.string().trim().max(120).default(''),
}).strict();
const giftQuery = z.object({ status: z.enum(Object.values(GIFT_CARD_STATUS)).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });

// Mount path: /api/admin/v1/customer-wallets
export function createAdminCustomerWalletRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  // An adjustment over the admin's own limit is not made: it waits for another admin to approve it (module approval).
  registerApprovalAction('customerWallet.adjust', { permission: 'wallet.adjust.create', run: ({ userId, amountPaise, reason }, requester) => adjustCustomerWallet(userId, { amountPaise, reason }, requester) });
  router.get('/:id', requirePermission('wallet.account.view'), validate({ params: idParams, query: ledgerQuery }), route(async (req, res) => sendData(res, await adminWalletView(req.params.id, req.query))));
  router.post('/:id/adjustments', requirePermission('wallet.adjust.create'), validate({ params: idParams, body: adjustBody }), route(async (req, res) => {
    const { amountPaise, reason } = req.body;
    if (!(await overLimit(req, 'walletAdjustLimit', Math.abs(amountPaise)))) return sendData(res, await adjustCustomerWallet(req.params.id, req.body, req.auth));
    const approval = await requestApproval({ kind: 'customerWallet.adjust', summary: `${amountPaise > 0 ? 'Credit' : 'Debit'} customer wallet by ₹${(Math.abs(amountPaise) / 100).toLocaleString('en-IN')}: ${reason}`, amountPaise: Math.abs(amountPaise), payload: { userId: req.params.id, amountPaise, reason } }, req.auth);
    return sendData(res, { approvalRequired: true, approval }, { status: 202 });
  }));
  router.post('/:id/freeze', requirePermission('wallet.account.freeze'), validate({ params: idParams, body: freezeBody }), route(async (req, res) => sendCommand(res, await freezeCustomerWallet(req.params.id, req.body, req.auth))));
  return router;
}

// Mount path: /api/admin/v1/gift-cards
export function createAdminGiftCardRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('wallet.giftcard.view'), validate({ query: giftQuery }), route(async (req, res) => sendData(res, await listGiftCards(req.query))));
  router.post('/', requirePermission('wallet.giftcard.generate'), validate({ body: generateBody }), route(async (req, res) => sendCommand(res, await generateGiftCards(req.body, req.auth), { status: 201 })));
  router.post('/:id/block', requirePermission('wallet.giftcard.block'), validate({ params: idParams }), route(async (req, res) => sendCommand(res, await blockGiftCard(req.params.id, req.auth))));
  return router;
}

const ruleFields = {
  name: z.string().trim().min(1, 'Give the rule a name customers will see.').max(80),
  pct: z.number().int().min(1).max(100),
  maxCashbackPaise: z.number().int().min(100).max(10_000_000),
  minOrderPaise: z.number().int().min(0).max(100_000_000),
  creditExpiryDays: z.number().int().min(0).max(730),
  budgetPaise: z.number().int().min(0).max(100_000_000_00),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};
const ruleCreate = z.object(ruleFields).strict().refine((rule) => rule.endsAt > rule.startsAt, { path: ['endsAt'], message: 'The end must be after the start.' });
const rulePatch = z.object(ruleFields).partial().strict();

// Mount path: /api/admin/v1/cashback-rules
export function createAdminCashbackRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('wallet.cashback.view'), route(async (_req, res) => sendData(res, await listCashbackRules())));
  router.post('/', requirePermission('wallet.cashback.create'), validate({ body: ruleCreate }), route(async (req, res) => sendCommand(res, await createCashbackRule(req.body, req.auth), { status: 201 })));
  router.patch('/:id', requirePermission('wallet.cashback.edit'), validate({ params: idParams, body: rulePatch }), route(async (req, res) => sendCommand(res, await updateCashbackRule(req.params.id, req.body, req.auth))));
  router.post('/:id/pause', requirePermission('wallet.cashback.pause'), validate({ params: idParams }), route(async (req, res) => sendCommand(res, await togglePauseCashbackRule(req.params.id, req.auth))));
  return router;
}
