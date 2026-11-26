import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { redeemGiftCard } from '../application/giftCard.service.js';
import { getWalletSummary, listWalletTransactions } from '../application/wallet.service.js';

const listQuery = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) });

// Mount path: /api/customer/v1/wallet
export function createCustomerWalletRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.CUSTOMER));
  router.get('/', async (req, res, next) => {
    try {
      return sendData(res, await getWalletSummary(req.auth.userId));
    } catch (error) {
      return next(error);
    }
  });
  router.get('/transactions', validate({ query: listQuery }), async (req, res, next) => {
    try {
      return sendData(res, await listWalletTransactions(req.auth.userId, req.query));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

const redeemBody = z.object({ code: z.string().trim().min(1).max(40), pin: z.string().trim().min(1).max(12) }).strict();

// Mount path: /api/customer/v1/gift-cards. Rate limited per IP so codes cannot be guessed.
export function createCustomerGiftCardRouter() {
  const router = Router();
  router.post('/redeem', createRateLimiter({ name: 'giftcard', windowMs: 15 * 60_000, limit: 20 }), authenticate, authorize(ROLES.CUSTOMER), validate({ body: redeemBody }), async (req, res, next) => {
    try {
      return sendData(res, await redeemGiftCard(req.auth.userId, req.body));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
