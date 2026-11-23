import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { HelpfulVote } from '../infrastructure/persistence/helpfulVote.model.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { ReviewReport } from '../infrastructure/persistence/reviewReport.model.js';

// "Found this helpful" votes on reviews and answers, and a customer flagging a review. One vote per person per item.

const DUPLICATE_KEY = 11000;
const failure = (status, code, message) => new AppError({ code, status, message });

/** Which of these ids (reviews or answers) this person already marked helpful, as a Set of id strings. */
export async function viewerVotes(userId, targetType, ids) {
  if (!userId || !ids.length) return new Set();
  const rows = await HelpfulVote.find({ targetType, userId: String(userId), targetId: { $in: ids } }, 'targetId').lean();
  return new Set(rows.map((row) => String(row.targetId)));
}

// The count moves only when the vote itself was added or removed, so pressing the button twice never counts twice.
async function vote(userId, targetType, Model, targetId, helpful) {
  const key = { targetType, targetId, userId: String(userId) };
  let changed;
  if (helpful) {
    try {
      await HelpfulVote.create(key);
      changed = true;
    } catch (error) {
      if (error?.code !== DUPLICATE_KEY) throw error;
      changed = false;
    }
  } else {
    changed = (await HelpfulVote.deleteOne(key)).deletedCount === 1;
  }
  if (changed) await Model.updateOne({ _id: targetId }, { $inc: { helpfulCount: helpful ? 1 : -1 } });
}

export async function setReviewHelpful(userId, reviewId, helpful) {
  const review = await Review.findOne({ _id: reviewId, status: 'PUBLISHED' }, 'customerId').lean();
  if (!review) throw failure(404, 'REVIEW_NOT_FOUND', 'This review was not found.');
  if (review.customerId === String(userId)) throw failure(409, 'CANNOT_VOTE_OWN', 'You cannot rate your own review.');
  await vote(userId, 'REVIEW', Review, reviewId, helpful);
  const fresh = await Review.findById(reviewId, 'helpfulCount').lean();
  return { id: reviewId, helpfulCount: fresh?.helpfulCount ?? 0, viewerFoundHelpful: helpful };
}

/** Returns the answer row after the vote; the caller shapes it for the app. */
export async function setAnswerHelpful(userId, answerId, helpful) {
  const answer = await Answer.findOne({ _id: answerId, status: 'PUBLISHED' }).lean();
  const question = answer && (await Question.exists({ _id: answer.questionId, status: 'PUBLISHED' }));
  if (!answer || !question) throw failure(404, 'ANSWER_NOT_FOUND', 'This answer was not found.');
  if (answer.authorType === 'CUSTOMER' && answer.authorId === String(userId)) throw failure(409, 'CANNOT_VOTE_OWN', 'You cannot rate your own answer.');
  await vote(userId, 'ANSWER', Answer, answerId, helpful);
  return Answer.findById(answerId).lean();
}

/** A customer tells us a published review breaks the rules; an admin decides (see adminAbuse.service.js). */
export async function reportReviewAsCustomer(customerId, reviewId, reason) {
  const review = await Review.findOne({ _id: reviewId, status: 'PUBLISHED' }).lean();
  if (!review) throw new NotFoundError('This review was not found.');
  if (review.customerId === String(customerId)) throw failure(409, 'CANNOT_REPORT_OWN', 'You cannot report your own review.');
  try {
    await ReviewReport.create({ targetId: review._id, targetExcerpt: review.body.slice(0, 80), reporterType: 'CUSTOMER', reporterId: String(customerId), reason });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw failure(409, 'REPORT_EXISTS', 'You already reported this review.');
    throw error;
  }
  return { reported: true };
}
