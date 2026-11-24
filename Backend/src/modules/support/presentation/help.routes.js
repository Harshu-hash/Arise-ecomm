import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize, optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { getSupportChannels } from '../application/chat.service.js';
import { getHelpArticle, getHelpCategory, listHelpCategories, searchHelp, setHelpFeedback } from '../application/help.service.js';

const idParams = z.object({ id: z.string().regex(/^[\w-]{1,64}$/) });
const searchQuery = z.object({ query: z.string().trim().max(100).default('') });
const feedbackBody = z.object({ helpful: z.boolean() });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1/help. Reading is public; only the helpful / not helpful answer needs a signed-in customer.
export function createCustomerHelpRouter() {
  const router = Router();
  router.get('/categories', route(async (_req, res) => sendData(res, listHelpCategories())));
  router.get('/categories/:id', validate({ params: idParams }), route(async (req, res) => sendData(res, getHelpCategory(req.params.id))));
  router.get('/search', validate({ query: searchQuery }), route(async (req, res) => sendData(res, searchHelp(req.query.query))));
  router.get('/articles/:id', optionalAuthenticate, validate({ params: idParams }), route(async (req, res) =>
    sendData(res, await getHelpArticle(req.params.id, req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null))));
  router.put('/articles/:id/feedback', authenticate, authorize(ROLES.CUSTOMER), validate({ params: idParams, body: feedbackBody }), route(async (req, res) =>
    sendData(res, await setHelpFeedback(req.auth.userId, req.params.id, req.body.helpful))));
  return router;
}

// Mounted at /api/seller/v1/support: sellers reach the platform by phone or email (live chat is for customers).
export function createSellerSupportRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));
  router.get('/channels', route(async (_req, res) => {
    const { availabilityLabel, channels } = await getSupportChannels();
    return sendData(res, { availabilityLabel, channels: channels.filter((channel) => channel.type !== 'CHAT') });
  }));
  return router;
}
