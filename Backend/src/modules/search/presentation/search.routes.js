import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { addRecentSearch, clearRecentSearches, getSuggestions, listRecentSearches } from '../application/search.service.js';

const suggestionsQuery = z.object({ q: z.string().trim().max(100).default('') });
const recentBody = z.object({ query: z.string().trim().min(1).max(100) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1/search, next to the product search itself. Suggestions are public; recent searches are the signed-in customer's own.
export function createCustomerSearchExtrasRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];

  router.get('/suggestions', validate({ query: suggestionsQuery }), route(async (req, res) => sendData(res, await getSuggestions(req.query.q))));
  router.get('/recent', ...customerOnly, route(async (req, res) => sendData(res, await listRecentSearches(req.auth.userId))));
  router.post('/recent', ...customerOnly, validate({ body: recentBody }), route(async (req, res) => sendCommand(res, await addRecentSearch(req.auth.userId, req.body.query), { status: 201 })));
  router.delete('/recent', ...customerOnly, route(async (req, res) => {
    await clearRecentSearches(req.auth.userId);
    return sendCommand(res, { cleared: true });
  }));

  return router;
}
