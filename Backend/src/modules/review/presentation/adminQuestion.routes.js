import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { scopedIds } from '../../../shared/middleware/scope.js';
import { getSellerProductIds } from '../../product/public/index.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { booleanQuery, csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { answerAsArise, getQuestionForAdmin, listQuestionsForAdmin, moderateAnswer, moderateQuestion } from '../application/adminQuestion.service.js';
import { REVIEW_STATUS } from '../domain/services/reviewRules.js';

const SORTS = { askedAt: 'createdAt', answerCount: 'answerCount' };
const listQuery = pageQuery.extend({ status: csvQuery(Object.values(REVIEW_STATUS)), unanswered: booleanQuery.optional() }).transform((query) => {
  const { sortField, sortDirection } = parseSort(query.sort || '-askedAt', Object.keys(SORTS), 'askedAt');
  return { ...query, sortField: SORTS[sortField], sortDirection: query.sort ? sortDirection : -1 };
});
const idParams = z.object({ id: objectIdSchema });
const decision = z.object({ status: z.enum(['PUBLISHED', 'REJECTED']), reason: z.string().trim().max(1000).optional() });
const answerBody = z.object({ text: z.string().trim().min(2, 'Write an answer.').max(2000) });

// The products an admin may see questions about: those their sellers sell, or null for all.
// shortcut: only products with a live offer from the seller count, so a product whose offers all went offline drops out; upgrade if that matters.
const scopedProductIds = async (req) => {
  const sellers = await scopedIds(req, 'sellers');
  return sellers ? [...new Set((await Promise.all(sellers.map(getSellerProductIds))).flat())] : null;
};
const questionInScope = (loadProductId) => async (req, _res, next, id) => {
  try {
    const products = await scopedProductIds(req);
    if (products && !products.includes(await loadProductId(id))) throw new NotFoundError('That question no longer exists.');
    return next();
  } catch (error) {
    return next(error);
  }
};

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mount path: /api/admin/v1/questions — the Q&A queue and answering as Arise.
export function createAdminQuestionRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.param('id', questionInScope(async (id) => (await Question.findById(id, 'productId').lean())?.productId));

  router.get('/', validate({ query: listQuery }), requirePermission('reviews.qa.view'), route(async (req, res) => {
    const { data, meta } = await listQuestionsForAdmin(req.query, { productIds: await scopedProductIds(req) });
    return sendData(res, data, { meta });
  }));
  router.get('/:id', validate({ params: idParams }), requirePermission('reviews.qa.view'), route(async (req, res) => sendData(res, await getQuestionForAdmin(req.params.id))));
  router.post('/:id/moderate', validate({ params: idParams, body: decision }), requirePermission('reviews.qa.moderate'), route(async (req, res) =>
    sendCommand(res, await moderateQuestion(req.params.id, req.body, req.auth))));
  router.post('/:id/answers', validate({ params: idParams, body: answerBody }), requirePermission('reviews.qa.answer'), route(async (req, res) =>
    sendCommand(res, await answerAsArise(req.params.id, req.body.text, req.auth), { status: 201 })));

  return router;
}

// Mount path: /api/admin/v1/answers.
export function createAdminAnswerRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.param('id', questionInScope(async (id) => (await Question.findById((await Answer.findById(id, 'questionId').lean())?.questionId, 'productId').lean())?.productId));
  router.post('/:id/moderate', validate({ params: idParams, body: decision }), requirePermission('reviews.qa.moderate'), route(async (req, res) =>
    sendCommand(res, await moderateAnswer(req.params.id, req.body, req.auth))));
  return router;
}
