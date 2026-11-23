import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { booleanQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { answerQuestion, listSellerQuestions } from '../application/sellerQuestion.service.js';
import { listSellerReviews, replyToReview, reportReview } from '../application/sellerReview.service.js';

const listQuery = pageQuery.extend({ rating: z.coerce.number().int().min(1).max(5).optional() }).transform((query) => {
  const { sortField, sortDirection } = parseSort(query.sort || '-submittedAt', ['submittedAt', 'rating'], 'submittedAt');
  return { ...query, sortField, sortDirection: query.sort ? sortDirection : -1 };
});
const questionQuery = pageQuery.extend({ slaBreached: booleanQuery.optional() }).transform((query) => {
  const { sortDirection } = parseSort(query.sort || '-askedAt', ['askedAt'], 'askedAt');
  return { ...query, sortField: 'createdAt', sortDirection: query.sort ? sortDirection : -1 };
});
const answerBody = z.object({ text: z.string().trim().min(1, 'Write an answer.').max(2000) });
const idParams = z.object({ id: objectIdSchema });
// The panel also sends evidenceMediaIds on a report; they are ignored (not stored yet) rather than rejected.
const replyBody = z.object({ text: z.string().trim().min(1, 'Write a public reply.').max(1000) });
const reportBody = z.object({ reason: z.string().trim().min(1, 'Explain why this content breaches policy.').max(1000) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/customer-experience: reviews of the signed-in seller's own products.
export function createSellerReviewRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/reviews', validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listSellerReviews(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/reviews/:id/reply', validate({ params: idParams, body: replyBody }), route(async (req, res) =>
    sendCommand(res, await replyToReview(sellerScope(req), req.params.id, req.body.text))));
  router.post('/reviews/:id/report', validate({ params: idParams, body: reportBody }), route(async (req, res) =>
    sendCommand(res, await reportReview(sellerScope(req), req.params.id, req.body.reason), { status: 201 })));

  router.get('/questions', validate({ query: questionQuery }), route(async (req, res) => {
    const { data, meta } = await listSellerQuestions(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/questions/:id/answers', validate({ params: idParams, body: answerBody }), route(async (req, res) =>
    sendCommand(res, await answerQuestion(sellerScope(req), req.params.id, req.body.text), { status: 201 })));

  return router;
}
