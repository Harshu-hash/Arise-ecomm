// Customer product reviews: who may review, what is auto-published, and how a review moves a product's rating. Pure.

export const REVIEW_STATUS = Object.freeze({ PENDING: 'PENDING', PUBLISHED: 'PUBLISHED', REJECTED: 'REJECTED' });
export const MAX_REVIEW_MEDIA = 5;

// A return that reached QC pass or a refund means the buyer no longer holds what they paid for.
export const REFUNDED_RETURN_STATUSES = ['QC_PASSED', 'REFUND_INITIATED', 'REFUND_COMPLETED'];

// shortcut: word lists and patterns are a first pass over the text, not a moderation service; swap for a real classifier if abuse gets through.
const PROFANITY = ['damn', 'crap', 'scam'];
const PII_PATTERN = /\b\d{10}\b|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const INCENTIVE_PATTERN = /free (product|gift)|in exchange for|sent me this to review/i;
const SPAM_PATTERN = /(visit|check out) (my|our) (channel|page|store)|www\.|http/i;

/** What is wrong with the text, or 'CLEAN'. */
export function classifyReview(text, minLength = 12) {
  const lower = text.toLowerCase();
  if (INCENTIVE_PATTERN.test(text)) return 'INCENTIVISED';
  if (SPAM_PATTERN.test(text)) return 'SPAM';
  if (PII_PATTERN.test(text)) return 'PII';
  if (PROFANITY.some((word) => lower.includes(word))) return 'PROFANITY';
  if (text.trim().length < minLength) return 'OFF_TOPIC';
  return 'CLEAN';
}

/** Every review is from a verified buyer (it is tied to an order item), so only clean text with no photos publishes itself. */
export function moderate({ title = '', body, mediaCount, minLength }) {
  const autoModeration = classifyReview(`${title} ${body}`.trim(), minLength);
  return { autoModeration, status: autoModeration === 'CLEAN' && mediaCount === 0 ? REVIEW_STATUS.PUBLISHED : REVIEW_STATUS.PENDING };
}

/** { eligible, reason } for one delivered-or-not item, given whether it was refunded and whether it already has a review. */
export function reviewState({ subStatus, refunded, existingReviewId }) {
  if (existingReviewId) return { eligible: false, reason: 'You already reviewed this item.' };
  if (subStatus !== 'DELIVERED') return { eligible: false, reason: 'Reviews are available after delivery.' };
  if (refunded) return { eligible: false, reason: 'This item was returned and refunded, so it can no longer be reviewed.' };
  return { eligible: true, reason: null };
}

/** What a review adds to its product's rating: only published reviews count. */
export const contribution = (review) => (review?.status === REVIEW_STATUS.PUBLISHED ? review.rating : null);

/** The $inc that takes a product's summary from `before` to `after` (each a review or null), or null when nothing changes. */
export function summaryChange(before, after) {
  const was = contribution(before);
  const now = contribution(after);
  if (was === now) return null;
  const inc = { count: (now ? 1 : 0) - (was ? 1 : 0), sum: (now ?? 0) - (was ?? 0) };
  if (was) inc[`s${was}`] = -1;
  if (now) inc[`s${now}`] = (inc[`s${now}`] ?? 0) + 1;
  return inc;
}

/** Contact details, links and off-platform requests are not allowed in anything shown publicly. */
export const isProhibitedPublicText = (text) => /(\b\d{10}\b|https?:\/\/|www\.|@[a-z0-9.-]+\.[a-z]{2,}|whats\s*app|telegram)/i.test(text);

export const averageOf = ({ count, sum }) => (count > 0 ? Math.round((sum / count) * 10) / 10 : null);
