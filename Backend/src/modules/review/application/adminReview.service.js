import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { publicUrl } from '../../../infrastructure/storage/local.storage.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { Review } from '../infrastructure/persistence/review.model.js';
import { transition } from './review.service.js';

// The admin moderation queue. Field names follow the admin panel (text, productTitle, certifiedBuyer, submittedAt, ...).

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const mediaUrl = (key) => deviceUrl(publicUrl(key));

export const toAdminRow = (review) => ({
  id: String(review._id),
  productId: review.productId,
  productTitle: review.productName,
  orderId: String(review.orderId),
  orderItemId: String(review.orderItemId),
  customerId: review.customerId,
  customerName: review.authorName,
  certifiedBuyer: true,
  rating: review.rating,
  title: review.title,
  text: review.body,
  variantLabel: review.variantLabel,
  mediaCount: review.media.length,
  media: review.media.map(mediaUrl),
  mediaHidden: review.mediaHidden,
  helpfulVotes: review.helpfulCount ?? 0,
  autoModeration: review.autoModeration,
  status: review.status,
  moderationReason: review.moderationReason ?? null,
  incentivised: review.incentivised,
  sellerReply: review.sellerReply ?? null,
  submittedAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
});

/** `sellerIds`: the sellers an admin is limited to (their role scope), or null for all. */
export async function listReviewsForAdmin(query, { sellerIds = null } = {}) {
  const match = sellerIds ? { sellerId: { $in: sellerIds } } : {};
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    match.$or = [{ productName: pattern }, { authorName: pattern }, { body: pattern }];
  }
  if (query.autoModeration) match.autoModeration = query.autoModeration;
  if (query.certifiedBuyer === false) match._id = { $in: [] }; // every review is from a verified buyer
  if (query.hasMedia !== undefined) match['media.0'] = { $exists: query.hasMedia };
  const filter = query.status.length ? { ...match, status: { $in: query.status } } : match;

  const [rows, total, byStatus, byCheck] = await Promise.all([
    Review.find(filter).sort({ [query.sortField]: query.sortDirection, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Review.countDocuments(filter),
    // Tab badges ignore the status filter so each tab keeps its own count.
    Review.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Review.aggregate([{ $match: filter }, { $group: { _id: '$autoModeration', count: { $sum: 1 } } }]),
  ]);
  const counts = (groups) => Object.fromEntries(groups.map((group) => [group._id, group.count]));
  return {
    data: rows.map(toAdminRow),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)), facets: { status: counts(byStatus), autoModeration: counts(byCheck) } },
  };
}

export async function getReviewForAdmin(reviewId) {
  const review = await Review.findById(reviewId).lean();
  if (!review) throw new NotFoundError('That review no longer exists.');
  // Other reviews by the same person, to spot review rings.
  const others = await Review.find({ customerId: review.customerId, _id: { $ne: review._id } }).sort({ _id: -1 }).limit(20).lean();
  return { ...toAdminRow(review), otherReviewsByAuthor: others.map(toAdminRow) };
}

async function act(reviewId, action, set, actor, { reason = null, allowedFrom = null } = {}) {
  const filter = { _id: reviewId, ...(allowedFrom ? { status: { $in: allowedFrom } } : {}) };
  const done = await transition(filter, set);
  if (!done) {
    if (!(await Review.exists({ _id: reviewId }))) throw new NotFoundError('That review no longer exists.');
    throw new ConflictError('NO_CHANGE', 'This review is already in that state.');
  }
  const { before, after } = done;
  await recordAudit({ action: `review.${action}`, subjectType: 'review', subjectId: reviewId, before: { status: before.status }, after: { status: after.status }, reason, actor });
  return { before, after };
}

export const tellCustomer = ({ before }, reason) => notify({
  to: { type: 'CUSTOMER', id: before.customerId },
  category: CATEGORY.ACCOUNT,
  key: `review-rejected:${before._id}:${before.updatedAt.getTime()}`,
  title: 'Your review was not published',
  body: `Your review of ${before.productName} was not published: ${reason}`,
  target: { type: 'PRODUCT', entityId: before.productId },
});

export async function publishReview(reviewId, actor) {
  await act(reviewId, 'publish', { status: REVIEW_STATUS.PUBLISHED, moderationReason: null }, actor, { allowedFrom: [REVIEW_STATUS.PENDING, REVIEW_STATUS.REJECTED] });
  return getReviewForAdmin(reviewId);
}

export async function rejectReview(reviewId, reason, actor) {
  if (!reason) throw new ValidationError('Say why this review is being rejected — the customer is notified.', { reason: ['Required.'] });
  const done = await act(reviewId, 'reject', { status: REVIEW_STATUS.REJECTED, moderationReason: reason }, actor, { reason, allowedFrom: [REVIEW_STATUS.PENDING, REVIEW_STATUS.PUBLISHED] });
  await tellCustomer(done, reason);
  return getReviewForAdmin(reviewId);
}

export async function flagIncentivised(reviewId, actor) {
  const reason = 'Seller-incentivised review';
  const done = await act(reviewId, 'flag_incentivised', { incentivised: true, status: REVIEW_STATUS.REJECTED, moderationReason: reason }, actor, { reason });
  await tellCustomer(done, reason);
  return getReviewForAdmin(reviewId);
}

export async function hideMedia(reviewId, actor) {
  const done = await Review.findOneAndUpdate({ _id: reviewId, 'media.0': { $exists: true } }, { $set: { media: [], mediaHidden: true } }).lean();
  if (!done) throw new ConflictError('NO_CHANGE', 'This review has no media to hide.');
  await recordAudit({ action: 'review.hide_media', subjectType: 'review', subjectId: reviewId, before: { mediaCount: done.media.length }, after: { mediaCount: 0 }, actor });
  return getReviewForAdmin(reviewId);
}

/** PUBLISH_CLEAN publishes the pending reviews whose text passed the auto-check; REJECT rejects each listed review. Returns how many changed. */
export async function bulkReviews({ action, reviewIds, reason }, actor) {
  if (action === 'REJECT' && !reason) throw new ValidationError('A reason is required to reject in bulk.', { reason: ['Required.'] });
  const rows = await Review.find({ _id: { $in: reviewIds }, ...(action === 'PUBLISH_CLEAN' ? { status: REVIEW_STATUS.PENDING, autoModeration: 'CLEAN' } : {}) }, '_id').lean();
  let affected = 0;
  for (const { _id } of rows) {
    try {
      if (action === 'PUBLISH_CLEAN') await act(_id, 'publish', { status: REVIEW_STATUS.PUBLISHED, moderationReason: null }, actor, { allowedFrom: [REVIEW_STATUS.PENDING] });
      else await tellCustomer(await act(_id, 'reject', { status: REVIEW_STATUS.REJECTED, moderationReason: reason }, actor, { reason, allowedFrom: [REVIEW_STATUS.PENDING, REVIEW_STATUS.PUBLISHED] }), reason);
      affected += 1;
    } catch (error) {
      if (!(error instanceof ConflictError || error instanceof NotFoundError)) throw error; // someone else decided it first, or the customer deleted it
    }
  }
  return { affected };
}

/** The admin decides on a seller's pending public reply to a review. A rejected reply tells the seller why and lets them write another. */
export async function moderateSellerReply(reviewId, { status, reason }, actor) {
  if (status === 'REJECTED' && !reason) throw new ValidationError('Explain why the reply was rejected.', { reason: ['Required.'] });
  const before = await Review.findOneAndUpdate(
    { _id: reviewId, 'sellerReply.status': 'PENDING' },
    { $set: { 'sellerReply.status': status, 'sellerReply.moderatedAt': new Date(), 'sellerReply.moderationReason': reason ?? null } },
  ).lean();
  if (!before) {
    if (!(await Review.exists({ _id: reviewId }))) throw new NotFoundError('That review no longer exists.');
    throw new ConflictError('NO_PENDING_REPLY', 'There is no pending seller reply.');
  }
  await recordAudit({ action: 'review.seller_reply_moderate', subjectType: 'review', subjectId: reviewId, before: { replyStatus: 'PENDING' }, after: { replyStatus: status }, reason: reason ?? null, actor });
  if (status === 'REJECTED') {
    await notify({
      to: { type: 'SELLER', id: before.sellerId },
      category: CATEGORY.SUPPORT,
      key: `review-reply-rejected:${before._id}:${before.sellerReply.submittedAt.getTime()}`,
      title: 'Your review reply was not published',
      body: `Your reply on a review of ${before.productName} was rejected: ${reason}`,
      severity: 'warning',
      link: '/customer-experience/reviews',
    });
  }
  return getReviewForAdmin(reviewId);
}
