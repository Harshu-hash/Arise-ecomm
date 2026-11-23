import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize, optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { setAnswerHelpful } from '../application/helpful.service.js';
import { createAnswer, createQuestion, getQuestion, listMyQuestions, listProductQuestions, toAnswerDto } from '../application/question.service.js';
import { viewerVotes } from '../application/helpful.service.js';

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).default(10), cursor: objectIdSchema.optional() });
const questionBody = z.object({ productId: objectIdSchema, body: z.string().trim().min(5).max(500) });
const answerBody = z.object({ body: z.string().trim().min(2).max(2000) });
const questionParams = z.object({ questionId: objectIdSchema });
const answerParams = z.object({ answerId: objectIdSchema });
const productParams = z.object({ productId: objectIdSchema });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1. Public questions are readable by anyone; asking, answering and voting need a customer.
export function createCustomerQuestionRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const writeLimit = createRateLimiter({ name: 'question-write', windowMs: 60_000, limit: 10 });
  const me = (req) => req.auth.userId;
  const viewer = (req) => (req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null);

  router.get('/products/:productId/questions', optionalAuthenticate, validate({ params: productParams, query: listQuery }), route(async (req, res) =>
    sendData(res, await listProductQuestions(req.params.productId, req.query, viewer(req)))));
  router.get('/questions/mine', ...customerOnly, validate({ query: listQuery }), route(async (req, res) =>
    sendData(res, await listMyQuestions(me(req), req.query))));
  router.post('/questions', ...customerOnly, writeLimit, validate({ body: questionBody }), route(async (req, res) =>
    sendCommand(res, await createQuestion(me(req), req.body), { status: 201 })));
  router.get('/questions/:questionId', optionalAuthenticate, validate({ params: questionParams }), route(async (req, res) =>
    sendData(res, await getQuestion(req.params.questionId, viewer(req)))));
  router.post('/questions/:questionId/answers', ...customerOnly, writeLimit, validate({ params: questionParams, body: answerBody }), route(async (req, res) =>
    sendCommand(res, await createAnswer(me(req), req.params.questionId, req.body), { status: 201 })));

  const helpful = (value) => route(async (req, res) => {
    const answer = await setAnswerHelpful(me(req), req.params.answerId, value);
    return sendCommand(res, toAnswerDto(answer, await viewerVotes(me(req), 'ANSWER', [answer._id])));
  });
  router.put('/answers/:answerId/helpful', ...customerOnly, validate({ params: answerParams }), helpful(true));
  router.delete('/answers/:answerId/helpful', ...customerOnly, validate({ params: answerParams }), helpful(false));

  return router;
}
