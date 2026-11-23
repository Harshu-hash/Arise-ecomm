import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { isProhibitedPublicText, REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { ReviewReport } from '../infrastructure/persistence/reviewReport.model.js';
import { mediaUrl } from './adminReview.service.js';

// What a seller does with reviews of their own products: read the published ones, answer them publicly, report abuse.
// Sellers never see a review that has not passed moderation, and never the buyer's name.

const DUPLICATE_KEY = 11000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORT_FIELD = { submittedAt: 'createdAt', rating: 'rating' };

const toReportDto = (report) => report && { id: String(report._id), status: report.status, reason: report.reason, reportedAt: report.createdAt.toISOString(), decisionReason: report.decisionReason ?? null };

const toSellerRow = (review, report) => ({
  id: String(review._id),
  productId: review.productId,
  productTitle: review.productName,
  orderItemId: String(review.orderItemId),
  customerName: 'Verified buyer',
  rating: review.rating,
  title: review.title,
  text: review.body,
  mediaCount: review.media.length,
  media: review.media.map(mediaUrl),
  helpfulVotes: review.helpfulCount ?? 0,
  status: review.status,
  submittedAt: review.createdAt.toISOString(),
  sellerReply: review.sellerReply ?? null,
  abuseReport: toReportDto(report),
});

export async function listSellerReviews(sellerId, query) {
  const filter = { sellerId: String(sellerId), status: REVIEW_STATUS.PUBLISHED };
  if (query.rating) filter.rating = query.rating;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ productName: pattern }, { body: pattern }];
  }
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ [SORT_FIELD[query.sortField]]: query.sortDirection, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Review.countDocuments(filter),
  ]);
  const reports = await ReviewReport.find({ reporterType: 'SELLER', reporterId: String(sellerId), targetId: { $in: rows.map((row) => row._id) } }).sort({ createdAt: 1 }).lean();
  const latest = new Map(reports.map((report) => [String(report.targetId), report])); // the newest one wins
  return {
    data: rows.map((row) => toSellerRow(row, latest.get(String(row._id)))),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)), facets: { status: { PUBLISHED: total } } },
  };
}

async function ownPublished(sellerId, reviewId) {
  const review = await Review.findOne({ _id: reviewId, sellerId: String(sellerId), status: REVIEW_STATUS.PUBLISHED }).lean();
  if (!review) throw new NotFoundError('That review is not for your store.');
  return review;
}

/** A public reply, shown on the review only after an admin publishes it. One at a time; a rejected one may be replaced. */
export async function replyToReview(sellerId, reviewId, text) {
  await ownPublished(sellerId, reviewId);
  if (isProhibitedPublicText(text)) throw new AppError({ code: 'PROHIBITED_CONTENT', status: 400, message: 'Contact details, external links and off-platform requests are prohibited.' });
  const authorName = (await getSellerSummaries([sellerId])).get(String(sellerId))?.name ?? 'Seller';
  const updated = await Review.findOneAndUpdate(
    { _id: reviewId, sellerId: String(sellerId), $or: [{ sellerReply: null }, { 'sellerReply.status': 'REJECTED' }] },
    { $set: { sellerReply: { text, status: 'PENDING', authorName, submittedAt: new Date() } } },
    { new: true },
  ).lean();
  if (!updated) throw new AppError({ code: 'REPLY_EXISTS', status: 409, message: 'A seller reply is already awaiting moderation or published.' });
  return toSellerRow(updated, null);
}

export async function reportReview(sellerId, reviewId, reason) {
  const review = await ownPublished(sellerId, reviewId);
  try {
    const report = await ReviewReport.create({ targetId: review._id, targetExcerpt: review.body.slice(0, 80), reporterType: 'SELLER', reporterId: String(sellerId), reason });
    return toReportDto(report.toObject());
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw new AppError({ code: 'REPORT_EXISTS', status: 409, message: 'This review already has an open report.' });
    throw error;
  }
}
