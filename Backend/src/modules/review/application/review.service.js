import { AppError } from '../../../shared/errors/AppError.js';
import { publicUrl } from '../../../infrastructure/storage/local.storage.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { getCustomerContact } from '../../identity/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { MAX_REVIEW_MEDIA, REFUNDED_RETURN_STATUSES, moderate, reviewState } from '../domain/services/reviewRules.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { viewerVotes } from './helpful.service.js';
import { applySummaryChange, getRatingBreakdown } from './ratingSummary.service.js';

// What a customer does with reviews: see whether an item can be reviewed, write, edit, delete and read them.
// Clean text-only reviews publish at once; the rest wait for an admin (moderate() in reviewRules.js).

const DUPLICATE_KEY = 11000;
const failure = (status, code, message) => new AppError({ code, status, message });
const notFound = () => failure(404, 'REVIEW_NOT_FOUND', 'This review was not found.');
const mediaUrl = (key) => deviceUrl(publicUrl(key));

/** The review as the customer app reads it. `owner`: the author's own view (edit/delete, and the rejection reason). */
export const toReviewDto = (review, { owner = false } = {}) => ({
  id: String(review._id),
  productId: review.productId,
  productName: review.productName,
  productImageUrl: deviceUrl(review.productImageUrl),
  orderItemId: String(review.orderItemId),
  rating: review.rating,
  title: review.title ?? '',
  body: review.body,
  media: review.media.map((key) => ({ id: key, thumbnailUrl: mediaUrl(key), url: mediaUrl(key) })),
  authorDisplayName: review.authorName,
  verifiedPurchase: true,
  helpfulCount: review.helpfulCount ?? 0,
  moderationStatus: review.status,
  rejectionReason: owner ? review.moderationReason ?? null : null,
  allowedActions: owner ? ['EDIT', 'DELETE'] : [],
  sellerReply: review.sellerReply?.status === 'PUBLISHED' ? { text: review.sellerReply.text, authorName: review.sellerReply.authorName, repliedAt: (review.sellerReply.moderatedAt ?? review.sellerReply.submittedAt).toISOString() } : null,
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
});

/**
 * Changes a review and moves its product's rating by exactly what changed. The update hands back the row as it was
 * (not a separate read), so two changes at once can never count the same review twice.
 */
export async function transition(filter, set) {
  const before = await Review.findOneAndUpdate(filter, { $set: set }, { new: false }).lean();
  if (!before) return null;
  const after = { ...before, ...set, updatedAt: new Date() };
  await applySummaryChange(before.productId, before, after);
  return { before, after };
}

async function locate(customerId, orderItemId) {
  const order = await Order.findOne({ customerId: String(customerId), 'subOrders.items._id': orderItemId }).lean();
  for (const sub of order?.subOrders ?? []) {
    const item = sub.items.find((candidate) => String(candidate._id) === orderItemId);
    if (item) return { order, sub, item };
  }
  throw failure(404, 'ORDER_ITEM_NOT_FOUND', 'This order item was not found.');
}

/** Whether this customer may review this order item right now, and why not. */
export async function getEligibility(customerId, orderItemId) {
  const found = await locate(customerId, orderItemId);
  const [existing, refunded] = await Promise.all([
    Review.findOne({ orderItemId }, '_id').lean(),
    Return.exists({ itemId: orderItemId, status: { $in: REFUNDED_RETURN_STATUSES } }),
  ]);
  const existingReviewId = existing ? String(existing._id) : null;
  return { ...found, existingReviewId, ...reviewState({ subStatus: found.sub.status, refunded: Boolean(refunded), existingReviewId }) };
}

export async function getReviewEligibility(customerId, orderItemId) {
  const { item, eligible, reason, existingReviewId } = await getEligibility(customerId, orderItemId);
  return { orderItemId, productId: item.productId, productName: item.name, productImageUrl: deviceUrl(item.imageUrl), eligible, reason, existingReviewId };
}

// Photos must be this customer's own review uploads: public/reviews/<customerId>/<file>.
const ownMedia = (customerId, key) => {
  const [visibility, folder, owner, file, ...rest] = String(key).split('/');
  return visibility === 'public' && folder === 'reviews' && owner === String(customerId) && Boolean(file) && !rest.length && !file.startsWith('.');
};

export async function createReview(customerId, { orderItemId, rating, title = '', body, mediaIds = [] }) {
  const state = await getEligibility(customerId, orderItemId);
  if (state.existingReviewId) throw failure(409, 'REVIEW_ALREADY_EXISTS', 'You already reviewed this item.');
  if (!state.eligible) throw failure(409, 'REVIEW_NOT_ELIGIBLE', state.reason);
  const media = [...new Set(mediaIds)];
  if (media.length > MAX_REVIEW_MEDIA || !media.every((key) => ownMedia(customerId, key))) throw failure(422, 'MEDIA_INVALID', 'One or more attachments are invalid.');

  const contact = await getCustomerContact(customerId);
  const verdict = moderate({ title, body, mediaCount: media.length });
  let review;
  try {
    review = await Review.create({
      orderItemId, orderId: state.order._id, subOrderId: state.sub._id, customerId: String(customerId),
      authorName: contact?.name?.trim() || 'Customer',
      productId: String(state.item.productId), sellerId: state.sub.sellerId,
      productName: state.item.name, productImageUrl: state.item.imageUrl ?? null, variantLabel: state.item.variantLabel ?? null,
      rating, title, body, media, status: verdict.status, autoModeration: verdict.autoModeration, incentivised: verdict.autoModeration === 'INCENTIVISED',
    });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw failure(409, 'REVIEW_ALREADY_EXISTS', 'You already reviewed this item.');
    throw error;
  }
  await applySummaryChange(review.productId, null, review);
  return toReviewDto(review.toObject(), { owner: true });
}

/** An edit is judged again like a new review: a published one that now needs a look leaves the product's rating until approved. */
export async function updateReview(customerId, reviewId, { rating, title = '', body }) {
  const current = await Review.findOne({ _id: reviewId, customerId: String(customerId) }, 'media').lean();
  if (!current) throw notFound();
  const verdict = moderate({ title, body, mediaCount: current.media.length });
  const done = await transition({ _id: reviewId, customerId: String(customerId) }, {
    rating, title, body, status: verdict.status, autoModeration: verdict.autoModeration, incentivised: verdict.autoModeration === 'INCENTIVISED', moderationReason: null,
  });
  if (!done) throw notFound();
  return toReviewDto(done.after, { owner: true });
}

export async function deleteReview(customerId, reviewId) {
  const before = await Review.findOneAndDelete({ _id: reviewId, customerId: String(customerId) }).lean();
  if (!before) throw notFound();
  await applySummaryChange(before.productId, before, null);
  return { deleted: true };
}

async function page(filter, { cursor, limit }, owner) {
  const rows = await Review.find(cursor ? { ...filter, _id: { $lt: cursor } } : filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const items = rows.slice(0, limit);
  return { items: items.map((row) => toReviewDto(row, { owner })), total: await Review.countDocuments(filter), nextCursor: rows.length > limit ? String(items.at(-1)._id) : null };
}

/** All of this customer's reviews, whatever their moderation state. */
export async function listMyReviews(customerId, query) {
  return { ...(await page({ customerId: String(customerId) }, query, true)), summary: null };
}

/** The published reviews of a product, newest first, with its rating. */
export async function listProductReviews(productId, query, viewerId = null) {
  const [reviews, summary] = await Promise.all([page({ productId: String(productId), status: 'PUBLISHED' }, query, false), getRatingBreakdown(productId)]);
  const votes = await viewerVotes(viewerId, 'REVIEW', reviews.items.map((item) => item.id));
  return { ...reviews, items: reviews.items.map((item) => ({ ...item, viewerFoundHelpful: votes.has(item.id) })), summary };
}
