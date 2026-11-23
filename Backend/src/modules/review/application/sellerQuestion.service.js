import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { getSellerProductIds } from '../../product/public/index.js';
import { isProhibitedPublicText, REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { toAnswerRow, toQuestionRow } from './adminQuestion.service.js';

// Questions about a seller's own products. A seller sees only public questions and must answer within the SLA;
// their answers wait for an admin before customers see them.

const SLA_MS = 2 * 86_400_000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listSellerQuestions(sellerId, query, now = Date.now()) {
  const seller = String(sellerId);
  // shortcut: matched by the seller's current LIVE product ids; fine until one seller lists tens of thousands of products.
  const filter = { productId: { $in: await getSellerProductIds(seller) }, status: REVIEW_STATUS.PUBLISHED };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ productName: pattern }, { body: pattern }];
  }
  if (query.slaBreached !== undefined) {
    // shortcut: the seller's answered questions are listed by id; fine until one seller has tens of thousands of answers.
    const answered = await Answer.distinct('questionId', { authorType: 'SELLER', authorId: seller });
    const due = new Date(now - SLA_MS);
    const breached = { createdAt: { $lt: due }, _id: { $nin: answered } };
    Object.assign(filter, query.slaBreached ? breached : { $and: [{ $or: [{ createdAt: { $gte: due } }, { _id: { $in: answered } }] }] });
  }
  const [rows, total] = await Promise.all([
    Question.find(filter).sort({ [query.sortField]: query.sortDirection, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Question.countDocuments(filter),
  ]);
  // Everyone's public answers, plus this seller's own whatever their state.
  const answers = await Answer.find({ questionId: { $in: rows.map((row) => row._id) }, $or: [{ status: REVIEW_STATUS.PUBLISHED }, { authorType: 'SELLER', authorId: seller }] }).sort({ _id: 1 }).lean();
  const byQuestion = new Map();
  for (const answer of answers) byQuestion.set(String(answer.questionId), [...(byQuestion.get(String(answer.questionId)) ?? []), answer]);
  return {
    data: rows.map((row) => {
      const own = byQuestion.get(String(row._id)) ?? [];
      const dueAt = new Date(row.createdAt.getTime() + SLA_MS);
      return {
        ...toQuestionRow(row),
        customerName: 'Buyer',
        customerId: undefined,
        answers: own.map(toAnswerRow),
        answerCount: own.length,
        responseDueAt: dueAt.toISOString(),
        slaBreached: !own.some((answer) => answer.authorType === 'SELLER' && answer.authorId === seller) && dueAt.getTime() < now,
      };
    }),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)), facets: { status: { PUBLISHED: total } } },
  };
}

export async function answerQuestion(sellerId, questionId, text) {
  const seller = String(sellerId);
  const question = await Question.findOne({ _id: questionId, productId: { $in: await getSellerProductIds(seller) }, status: REVIEW_STATUS.PUBLISHED }, '_id').lean();
  if (!question) throw new NotFoundError('That question is not for one of your products.');
  if (isProhibitedPublicText(text)) throw new AppError({ code: 'PROHIBITED_CONTENT', status: 400, message: 'Contact details, external links and off-platform requests are prohibited.' });
  if (await Answer.exists({ questionId, authorType: 'SELLER', authorId: seller, status: REVIEW_STATUS.PENDING })) {
    throw new AppError({ code: 'ANSWER_PENDING', status: 409, message: 'Your answer is already awaiting moderation.' });
  }
  const authorName = (await getSellerSummaries([seller])).get(seller)?.name ?? 'Seller';
  const answer = await Answer.create({ questionId, authorType: 'SELLER', authorId: seller, authorName, body: text, status: REVIEW_STATUS.PENDING });
  return toAnswerRow(answer.toObject());
}
