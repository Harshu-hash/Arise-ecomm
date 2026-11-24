import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { scopedIds } from '../../../shared/middleware/scope.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { booleanQuery, csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { bulkReviews, flagIncentivised, getReviewForAdmin, hideMedia, listReviewsForAdmin, moderateSellerReply, publishReview, rejectReview } from '../application/adminReview.service.js';
import { REVIEW_STATUS } from '../domain/services/reviewRules.js';

const SORTS = { submittedAt: 'createdAt', rating: 'rating', helpfulVotes: 'helpfulCount' };
const listQuery = pageQuery.extend({
  status: csvQuery(Object.values(REVIEW_STATUS)),
  autoModeration: z.enum(['CLEAN', 'PROFANITY', 'PII', 'SPAM', 'INCENTIVISED', 'OFF_TOPIC']).optional(),
  certifiedBuyer: booleanQuery.optional(),
  hasMedia: booleanQuery.optional(),
}).transform((query) => {
  const { sortField, sortDirection } = parseSort(query.sort || '-submittedAt', Object.keys(SORTS), 'submittedAt');
  return { ...query, sortField: SORTS[sortField], sortDirection: query.sort ? sortDirection : -1 };
});
const idParams = z.object({ id: objectIdSchema });
const reasonBody = z.object({ reason: z.string().trim().max(1000).optional() });
const replyDecisionBody = z.object({ status: z.enum(['PUBLISHED', 'REJECTED']), reason: z.string().trim().max(1000).optional() });
const bulkBody = z.object({
  action: z.enum(['PUBLISH_CLEAN', 'REJECT']),
  reviewIds: z.array(objectIdSchema).min(1).max(200),
  reason: z.string().trim().max(1000).optional(),
});

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mount path: /api/admin/v1/reviews — the moderation queue behind the console's Reviews page.
export function createAdminReviewRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  // An admin limited to some sellers only sees reviews of those sellers' products; any other review answers 404.
  router.param('id', async (req, _res, next, id) => {
    try {
      const sellers = await scopedIds(req, 'sellers');
      if (sellers && !(await Review.exists({ _id: id, sellerId: { $in: sellers } }))) throw new NotFoundError('That review no longer exists.');
      return next();
    } catch (error) {
      return next(error);
    }
  });
  const view = requirePermission('reviews.review.view');
  const moderate = requirePermission('reviews.review.moderate');

  router.get('/', validate({ query: listQuery }), view, route(async (req, res) => {
    const { data, meta } = await listReviewsForAdmin(req.query, { sellerIds: await scopedIds(req, 'sellers') });
    return sendData(res, data, { meta });
  }));
  router.post('/bulk', validate({ body: bulkBody }), moderate, route(async (req, res) => {
    const sellers = await scopedIds(req, 'sellers');
    if (sellers && (await Review.countDocuments({ _id: { $in: req.body.reviewIds }, sellerId: { $in: sellers } })) !== new Set(req.body.reviewIds).size) throw new NotFoundError('One of those reviews no longer exists.');
    return sendCommand(res, await bulkReviews(req.body, req.auth));
  }));
  router.get('/:id', validate({ params: idParams }), view, route(async (req, res) => sendData(res, await getReviewForAdmin(req.params.id))));
  router.post('/:id/publish', validate({ params: idParams }), moderate, route(async (req, res) => sendCommand(res, await publishReview(req.params.id, req.auth))));
  router.post('/:id/reject', validate({ params: idParams, body: reasonBody }), moderate, route(async (req, res) => sendCommand(res, await rejectReview(req.params.id, req.body.reason, req.auth))));
  router.post('/:id/reply/moderate', validate({ params: idParams, body: replyDecisionBody }), moderate, route(async (req, res) => sendCommand(res, await moderateSellerReply(req.params.id, req.body, req.auth))));
  router.post('/:id/hide-media', validate({ params: idParams }), moderate, route(async (req, res) => sendCommand(res, await hideMedia(req.params.id, req.auth))));
  router.post('/:id/flag-incentivised', validate({ params: idParams }), moderate, route(async (req, res) => sendCommand(res, await flagIncentivised(req.params.id, req.auth))));

  return router;
}
