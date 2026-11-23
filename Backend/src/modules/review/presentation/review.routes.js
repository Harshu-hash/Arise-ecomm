import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize, optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { MAX_REVIEW_MEDIA } from '../domain/services/reviewRules.js';
import { reportReviewAsCustomer, setReviewHelpful } from '../application/helpful.service.js';
import { createReview, deleteReview, getReviewEligibility, listMyReviews, listProductReviews, updateReview } from '../application/review.service.js';

const rating = z.number().int().min(1).max(5);
const title = z.string().trim().max(100).default('');
const body = z.string().trim().min(10).max(2000);
// The app also sends productId (the order item decides it); unknown keys are dropped.
const createBody = z.object({ orderItemId: objectIdSchema, rating, title, body, mediaIds: z.array(z.string().max(300)).max(MAX_REVIEW_MEDIA).default([]) });
const updateBody = z.object({ rating, title, body });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).default(10), cursor: objectIdSchema.optional() });
const reviewParams = z.object({ reviewId: objectIdSchema });
const productParams = z.object({ productId: objectIdSchema });
const itemParams = z.object({ orderItemId: objectIdSchema });
const reportBody = z.object({ reason: z.string().trim().min(3, 'Say what is wrong with this review.').max(500) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1. A product's reviews are public; everything else is the signed-in customer's own.
// No Idempotency-Key (the app sends none): the unique index on the order item makes a repeated submit a 409.
export function createCustomerReviewRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const writeLimit = createRateLimiter({ name: 'review-write', windowMs: 60_000, limit: 10 });
  const reportLimit = createRateLimiter({ name: 'review-report', windowMs: 60_000, limit: 10 });
  const me = (req) => req.auth.userId;

  router.get('/products/:productId/reviews', optionalAuthenticate, validate({ params: productParams, query: listQuery }), route(async (req, res) =>
    sendData(res, await listProductReviews(req.params.productId, req.query, req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null))));
  router.get('/order-items/:orderItemId/review-eligibility', ...customerOnly, validate({ params: itemParams }), route(async (req, res) =>
    sendData(res, await getReviewEligibility(me(req), req.params.orderItemId))));
  router.get('/reviews/mine', ...customerOnly, validate({ query: listQuery }), route(async (req, res) =>
    sendData(res, await listMyReviews(me(req), req.query))));
  router.post('/reviews', ...customerOnly, writeLimit, validate({ body: createBody }), route(async (req, res) =>
    sendCommand(res, await createReview(me(req), req.body), { status: 201 })));
  router.patch('/reviews/:reviewId', ...customerOnly, writeLimit, validate({ params: reviewParams, body: updateBody }), route(async (req, res) =>
    sendCommand(res, await updateReview(me(req), req.params.reviewId, req.body))));
  router.delete('/reviews/:reviewId', ...customerOnly, validate({ params: reviewParams }), route(async (req, res) =>
    sendCommand(res, await deleteReview(me(req), req.params.reviewId))));

  router.put('/reviews/:reviewId/helpful', ...customerOnly, validate({ params: reviewParams }), route(async (req, res) =>
    sendCommand(res, await setReviewHelpful(me(req), req.params.reviewId, true))));
  router.delete('/reviews/:reviewId/helpful', ...customerOnly, validate({ params: reviewParams }), route(async (req, res) =>
    sendCommand(res, await setReviewHelpful(me(req), req.params.reviewId, false))));
  router.post('/reviews/:reviewId/report', ...customerOnly, reportLimit, validate({ params: reviewParams, body: reportBody }), route(async (req, res) =>
    sendCommand(res, await reportReviewAsCustomer(me(req), req.params.reviewId, req.body.reason), { status: 201 })));

  return router;
}
