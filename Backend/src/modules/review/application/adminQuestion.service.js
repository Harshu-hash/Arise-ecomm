import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { getQuestionableProduct } from '../../product/public/index.js';
import { REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { announceAnswer, announceQuestion, tellAsker } from './qaNotifications.js';

// The admin Q&A queue. Field names follow the admin panel (text, productTitle, askedAt, ...).

const DAY_MS = 86_400_000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An answer as the admin and seller panels read it (support answers are "ARISE" there). */
export const toAnswerRow = (answer) => ({
  id: String(answer._id),
  questionId: String(answer.questionId),
  authorType: answer.authorType === 'SUPPORT' ? 'ARISE' : answer.authorType,
  authorName: answer.authorName,
  text: answer.body,
  helpfulVotes: answer.helpfulCount ?? 0,
  status: answer.status,
  moderationReason: answer.moderationReason ?? null,
  answeredAt: answer.createdAt.toISOString(),
});

export const toQuestionRow = (question) => ({
  id: String(question._id),
  productId: question.productId,
  productTitle: question.productName,
  customerId: question.customerId,
  customerName: question.authorName,
  text: question.body,
  status: question.status,
  moderationReason: question.moderationReason ?? null,
  askedAt: question.createdAt.toISOString(),
});

export async function listQuestionsForAdmin(query) {
  const match = {};
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    match.$or = [{ productName: pattern }, { authorName: pattern }, { body: pattern }];
  }
  const filter = query.status.length ? { ...match, status: { $in: query.status } } : match;
  const after = [];
  if (query.unanswered !== undefined) after.push({ $match: { answerCount: query.unanswered ? 0 : { $gt: 0 } } });

  const [result, byStatus] = await Promise.all([
    Question.aggregate([
      { $match: filter },
      { $lookup: { from: 'answers', let: { qid: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$questionId', '$$qid'] }, status: REVIEW_STATUS.PUBLISHED } }, { $count: 'n' }], as: 'published' } },
      { $addFields: { answerCount: { $ifNull: [{ $arrayElemAt: ['$published.n', 0] }, 0] } } },
      { $project: { published: 0 } },
      ...after,
      { $facet: {
        rows: [{ $sort: { [query.sortField]: query.sortDirection, _id: -1 } }, { $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
        total: [{ $count: 'n' }],
      } },
    ]),
    // Tab badges ignore the status filter so each tab keeps its own count.
    Question.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const rows = result[0].rows;
  const total = result[0].total[0]?.n ?? 0;
  const pending = await Answer.find({ questionId: { $in: rows.map((row) => row._id) }, authorType: 'SELLER', status: REVIEW_STATUS.PENDING }).lean();
  const pendingByQuestion = new Map(pending.map((answer) => [String(answer.questionId), answer]));
  return {
    data: rows.map((row) => ({
      ...toQuestionRow(row),
      answerCount: row.answerCount,
      pendingSellerAnswer: pendingByQuestion.has(String(row._id)) ? toAnswerRow(pendingByQuestion.get(String(row._id))) : null,
      unansweredDays: row.answerCount ? null : Math.floor((Date.now() - row.createdAt.getTime()) / DAY_MS),
    })),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)), facets: { status: Object.fromEntries(byStatus.map((row) => [row._id, row.count])) } },
  };
}

export async function getQuestionForAdmin(questionId) {
  const question = await Question.findById(questionId).lean();
  if (!question) throw new NotFoundError('That question no longer exists.');
  const answers = await Answer.find({ questionId: question._id }).sort({ _id: 1 }).lean();
  return { ...toQuestionRow(question), answers: answers.map(toAnswerRow) };
}

export async function moderateQuestion(questionId, { status, reason }, actor) {
  if (status === REVIEW_STATUS.REJECTED && !reason) throw new ValidationError('Say why this question is being rejected — the customer is notified.', { reason: ['Required.'] });
  const before = await Question.findOneAndUpdate({ _id: questionId, status: { $ne: status } }, { $set: { status, moderationReason: status === REVIEW_STATUS.REJECTED ? reason : null } }).lean();
  if (!before) {
    if (!(await Question.exists({ _id: questionId }))) throw new NotFoundError('That question no longer exists.');
    throw new ConflictError('NO_CHANGE', 'This question is already in that state.');
  }
  await recordAudit({ action: 'qa.moderate_question', subjectType: 'question', subjectId: questionId, before: { status: before.status }, after: { status }, reason: reason ?? null, actor });
  if (status === REVIEW_STATUS.PUBLISHED) await announceQuestion(before, (await getQuestionableProduct(before.productId))?.sellerIds ?? []);
  else await tellAsker(before, 'Your question was not published', `Your question about ${before.productName} was not published: ${reason}`);
  return getQuestionForAdmin(questionId);
}

/** An answer from Arise itself: public at once. */
export async function answerAsArise(questionId, text, actor) {
  const question = await Question.findOne({ _id: questionId, status: REVIEW_STATUS.PUBLISHED }).lean();
  if (!question) throw new NotFoundError('That question is not public.');
  const answer = await Answer.create({ questionId: question._id, authorType: 'SUPPORT', authorId: String(actor.userId), authorName: 'Arise Support', body: text, status: REVIEW_STATUS.PUBLISHED });
  await recordAudit({ action: 'qa.answer', subjectType: 'question', subjectId: questionId, after: { answerId: String(answer._id) }, actor });
  await announceAnswer(question, answer);
  return toAnswerRow(answer.toObject());
}

/** Publish or reject an answer (a seller's waits here first). */
export async function moderateAnswer(answerId, { status, reason }, actor) {
  const before = await Answer.findOneAndUpdate({ _id: answerId, status: { $ne: status } }, { $set: { status, moderationReason: status === REVIEW_STATUS.REJECTED ? reason ?? null : null } }).lean();
  if (!before) {
    if (!(await Answer.exists({ _id: answerId }))) throw new NotFoundError('That answer no longer exists.');
    throw new ConflictError('NO_CHANGE', 'This answer is already in that state.');
  }
  await recordAudit({ action: 'qa.moderate_answer', subjectType: 'answer', subjectId: answerId, before: { status: before.status }, after: { status }, reason: reason ?? null, actor });
  if (status === REVIEW_STATUS.PUBLISHED) {
    const question = await Question.findOne({ _id: before.questionId, status: REVIEW_STATUS.PUBLISHED }).lean();
    if (question) await announceAnswer(question, before);
  }
  return toAnswerRow({ ...before, status });
}
