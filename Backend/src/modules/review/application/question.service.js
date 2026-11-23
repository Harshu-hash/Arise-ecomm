import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getCustomerContact } from '../../identity/public/index.js';
import { getQuestionableProduct } from '../../product/public/index.js';
import { moderate, REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { viewerVotes } from './helpful.service.js';
import { announceAnswer, announceQuestion } from './qaNotifications.js';

// What a customer does with product questions: ask, read, answer someone else's, and (in helpful.service.js) vote on answers.
// Clean text publishes at once; the rest waits for an admin. Short text is fine here (an answer may be just "Yes").

const MIN_TEXT = 2;
const failure = (status, code, message) => new AppError({ code, status, message });
const notFound = () => failure(404, 'QUESTION_NOT_FOUND', 'This question was not found.');

/** The answer as the customer app reads it. */
export const toAnswerDto = (answer, votes = new Set()) => ({
  id: String(answer._id),
  body: answer.body,
  authorDisplayName: answer.authorName,
  authorType: answer.authorType,
  helpfulCount: answer.helpfulCount ?? 0,
  viewerFoundHelpful: votes.has(String(answer._id)),
  moderationStatus: answer.status,
  createdAt: answer.createdAt.toISOString(),
});

const toQuestionDto = (question, { count = 0, preview = null, owner = false } = {}) => ({
  id: String(question._id),
  productId: question.productId,
  productName: question.productName,
  body: question.body,
  authorDisplayName: question.authorName,
  answersCount: count,
  answerPreview: preview,
  moderationStatus: question.status,
  rejectionReason: owner ? question.moderationReason ?? null : null,
  createdAt: question.createdAt.toISOString(),
});

/** Published-answer count and the most helpful one (oldest wins a tie) for each question. */
async function answerStats(questionIds, viewerId) {
  const answers = await Answer.find({ questionId: { $in: questionIds }, status: REVIEW_STATUS.PUBLISHED }).sort({ helpfulCount: -1, _id: 1 }).lean();
  const votes = await viewerVotes(viewerId, 'ANSWER', answers.map((answer) => answer._id));
  const stats = new Map();
  for (const answer of answers) {
    const key = String(answer.questionId);
    const entry = stats.get(key) ?? { count: 0, preview: toAnswerDto(answer, votes) };
    entry.count += 1;
    stats.set(key, entry);
  }
  return stats;
}

async function page(filter, { cursor, limit }, { owner = false, viewerId = null } = {}) {
  const rows = await Question.find(cursor ? { ...filter, _id: { $lt: cursor } } : filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const items = rows.slice(0, limit);
  const stats = await answerStats(items.map((row) => row._id), viewerId);
  return {
    items: items.map((row) => toQuestionDto(row, { ...stats.get(String(row._id)), owner })),
    total: await Question.countDocuments(filter),
    nextCursor: rows.length > limit ? String(items.at(-1)._id) : null,
  };
}

export const listProductQuestions = (productId, query, viewerId) => page({ productId: String(productId), status: REVIEW_STATUS.PUBLISHED }, query, { viewerId });
export const listMyQuestions = (customerId, query) => page({ customerId: String(customerId) }, query, { owner: true, viewerId: customerId });

/** A question with its answers: published ones, plus the viewer's own answers whatever their state. */
export async function getQuestion(questionId, viewerId = null) {
  const question = await Question.findById(questionId).lean();
  const owner = Boolean(viewerId) && question?.customerId === String(viewerId);
  if (!question || (question.status !== REVIEW_STATUS.PUBLISHED && !owner)) throw notFound();
  const answers = await Answer.find({
    questionId: question._id,
    $or: [{ status: REVIEW_STATUS.PUBLISHED }, ...(viewerId ? [{ authorType: 'CUSTOMER', authorId: String(viewerId) }] : [])],
  }).sort({ helpfulCount: -1, _id: 1 }).lean();
  const votes = await viewerVotes(viewerId, 'ANSWER', answers.map((answer) => answer._id));
  const published = answers.filter((answer) => answer.status === REVIEW_STATUS.PUBLISHED);
  return { ...toQuestionDto(question, { count: published.length, preview: published[0] ? toAnswerDto(published[0], votes) : null, owner }), answers: answers.map((answer) => toAnswerDto(answer, votes)) };
}

export async function createQuestion(customerId, { productId, body }) {
  const product = await getQuestionableProduct(productId);
  if (!product) throw new NotFoundError('Product not found.');
  const contact = await getCustomerContact(customerId);
  const verdict = moderate({ body, mediaCount: 0, minLength: MIN_TEXT });
  const question = await Question.create({
    customerId: String(customerId), authorName: contact?.name?.trim() || 'Customer', productId: product.id, productName: product.title,
    body, status: verdict.status, autoModeration: verdict.autoModeration,
  });
  if (question.status === REVIEW_STATUS.PUBLISHED) await announceQuestion(question, product.sellerIds);
  return getQuestion(question._id, customerId);
}

export async function createAnswer(customerId, questionId, { body }) {
  const question = await Question.findOne({ _id: questionId, status: REVIEW_STATUS.PUBLISHED }).lean();
  if (!question) throw notFound();
  const contact = await getCustomerContact(customerId);
  const verdict = moderate({ body, mediaCount: 0, minLength: MIN_TEXT });
  const answer = await Answer.create({
    questionId: question._id, authorType: 'CUSTOMER', authorId: String(customerId), authorName: contact?.name?.trim() || 'Customer', body, status: verdict.status,
  });
  if (answer.status === REVIEW_STATUS.PUBLISHED) await announceAnswer(question, answer);
  return toAnswerDto(answer.toObject());
}
