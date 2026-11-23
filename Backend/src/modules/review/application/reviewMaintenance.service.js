import { HelpfulVote } from '../infrastructure/persistence/helpfulVote.model.js';
import { Answer, Question } from '../infrastructure/persistence/question.model.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { ReviewReport } from '../infrastructure/persistence/reviewReport.model.js';
import { ReviewSummary } from '../infrastructure/persistence/reviewSummary.model.js';
import { applySummaryChange } from './ratingSummary.service.js';

/**
 * Account deletion: the customer's reviews go with them (each product's rating is taken back by exactly what they added),
 * and so do their questions, answers, open reports and helpful votes (the counts they added come off). Returns how many reviews went.
 */
export async function deleteCustomerReviews(customerId) {
  const who = String(customerId);
  const mine = await Review.find({ customerId: who }).lean();
  if (mine.length) {
    await Review.deleteMany({ _id: { $in: mine.map((review) => review._id) } });
    for (const review of mine) await applySummaryChange(review.productId, review, null);
  }
  await Promise.all([
    Question.deleteMany({ customerId: who }),
    Answer.deleteMany({ authorType: 'CUSTOMER', authorId: who }),
    ReviewReport.deleteMany({ reporterType: 'CUSTOMER', reporterId: who, status: 'OPEN' }),
  ]);
  const votes = await HelpfulVote.find({ userId: who }).lean();
  const models = { REVIEW: Review, ANSWER: Answer };
  await Promise.all(votes.map((vote) => models[vote.targetType].updateOne({ _id: vote.targetId }, { $inc: { helpfulCount: -1 } })));
  await HelpfulVote.deleteMany({ userId: who });
  return mine.length;
}

/** orderIds -> Map(orderItemId -> reviewId), so an order can say which of its items were already reviewed. */
export async function getReviewedItems(orderIds) {
  const rows = await Review.find({ orderId: { $in: orderIds } }, 'orderItemId').lean();
  return new Map(rows.map((row) => [String(row.orderItemId), String(row._id)]));
}

const STARS = [1, 2, 3, 4, 5];
const zero = { count: 0, sum: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };

/**
 * Recounts every product's rating from its published reviews and corrects any total that drifted (e.g. a crash between
 * saving a review and updating its total). Returns how many products were fixed. Meant for the quiet hours: a review
 * changing during the run is picked up by the next one.
 */
export async function rebuildRatingSummaries() {
  const truth = await Review.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$productId', count: { $sum: 1 }, sum: { $sum: '$rating' }, ...Object.fromEntries(STARS.map((n) => [`s${n}`, { $sum: { $cond: [{ $eq: ['$rating', n] }, 1, 0] } }])) } },
  ]);
  let fixed = 0;
  if (truth.length) {
    const result = await ReviewSummary.bulkWrite(truth.map(({ _id: productId, ...totals }) => ({
      updateOne: { filter: { productId }, update: { $set: totals }, upsert: true },
    })));
    fixed += result.modifiedCount + result.upsertedCount;
  }
  const stale = await ReviewSummary.updateMany({ productId: { $nin: truth.map((row) => row._id) }, count: { $ne: 0 } }, { $set: zero });
  return fixed + stale.modifiedCount;
}
