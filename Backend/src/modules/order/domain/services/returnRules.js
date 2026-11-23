// What a customer may return, and why not. Pure. Refund only for now: no replacements.
import { returnWindowEndsAt, SUB } from './orderStatus.js';

/** The reasons the customer picks from (the app shows `label`); `requiresEvidence` reasons need a photo. `fault` is who it counts against. */
export const RETURN_REASONS = Object.freeze([
  { code: 'DAMAGED', label: 'Item is damaged or defective', requiresEvidence: true, fault: 'SELLER' },
  { code: 'NOT_AS_DESCRIBED', label: 'Item is not as described', requiresEvidence: false, fault: 'SELLER' },
  { code: 'WRONG_ITEM', label: 'Received the wrong item', requiresEvidence: true, fault: 'SELLER' },
  { code: 'SIZE_FIT', label: 'Size or fit issue', requiresEvidence: false, fault: 'CUSTOMER' },
  { code: 'CHANGED_MIND', label: 'Changed my mind', requiresEvidence: false, fault: 'CUSTOMER' },
]);

export const MAX_EVIDENCE_FILES = 5;
export const PICKUP_DAYS = 5; // how long the courier has to collect a booked pickup before it is chased
export const PICKUP_CHASE_DAYS = 3; // and how long it gets after being chased once, before the return lapses
export const QC_HOURS = 72; // how long the seller has to check a returned item once it is with them
export const qcDeadline = (receivedAt = new Date()) => new Date(receivedAt.getTime() + QC_HOURS * 3_600_000);

// Same words the customer app uses for a return's status.
export const RETURN_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED', APPROVED: 'APPROVED', PICKUP_SCHEDULED: 'PICKUP_SCHEDULED', PICKED_UP: 'PICKED_UP', RECEIVED: 'RECEIVED',
  QC_PASSED: 'QC_PASSED', QC_FAILED: 'QC_FAILED', REJECTED: 'REJECTED', REFUND_INITIATED: 'REFUND_INITIATED', REFUND_COMPLETED: 'REFUND_COMPLETED', CANCELLED: 'CANCELLED',
});

/** What the customer's status screen calls each stage. */
export const RETURN_LABELS = Object.freeze({
  REQUESTED: 'Return requested', APPROVED: 'Approved by the seller', PICKUP_SCHEDULED: 'Pickup scheduled', PICKED_UP: 'Picked up from you',
  RECEIVED: 'Received by the seller', QC_PASSED: 'Quality check passed', QC_FAILED: 'Quality check failed', REJECTED: 'Not approved',
  REFUND_INITIATED: 'Refund initiated', REFUND_COMPLETED: 'Refund completed', CANCELLED: 'Cancelled',
});

/** The customer may withdraw a request until the courier has collected the item. */
export const CUSTOMER_CANCELLABLE = [RETURN_STATUS.REQUESTED, RETURN_STATUS.APPROVED, RETURN_STATUS.PICKUP_SCHEDULED];

const day = (date) => date.toISOString().slice(0, 10);

/** { eligible, reason, windowEndsAt } for one item of a parcel. `hasActiveReturn`: a return for it is already open or done. */
export function returnState(sub, item, hasActiveReturn, now = new Date()) {
  const windowEndsAt = returnWindowEndsAt(sub, item);
  const no = (reason) => ({ eligible: false, reason, windowEndsAt });
  if (hasActiveReturn) return no('A return request already exists for this item.');
  if (sub.status !== SUB.DELIVERED) return no('Only delivered items can be returned.');
  // shortcut: a cash payment has no original payment to refund to and wallet credit is not built, so cash-on-delivery orders are not returnable yet
  if (sub.codDuePaise > 0) return no('Returns for cash-on-delivery orders are not available yet. Please contact support.');
  if (!windowEndsAt) return no('This item cannot be returned.');
  if (now > windowEndsAt) return no(`The return window closed on ${day(windowEndsAt)}.`);
  return { eligible: true, reason: null, windowEndsAt };
}

// ---- the seller's side. The seller panel has its own words for some statuses.
const S = RETURN_STATUS;
export const SELLER_STAGES = Object.freeze({
  REQUESTED: [S.REQUESTED], // needs a decision
  IN_PROGRESS: [S.APPROVED, S.PICKUP_SCHEDULED, S.PICKED_UP, S.RECEIVED],
  COMPLETED: [S.QC_PASSED, S.QC_FAILED, S.REJECTED, S.REFUND_INITIATED, S.REFUND_COMPLETED, S.CANCELLED],
});

/** From which statuses each seller action may start. The seller, who gets the parcel, marks it received (the courier's reverse scans do not exist yet). */
export const SELLER_FROM = Object.freeze({
  approve: [S.REQUESTED],
  reject: [S.REQUESTED],
  receive: [S.APPROVED, S.PICKUP_SCHEDULED, S.PICKED_UP],
  qc: [S.RECEIVED],
  'schedule-pickup': [S.APPROVED], // approved but no courier booked yet (or a step of booking failed)
});
export const sellerActionsOf = (status) => Object.entries(SELLER_FROM).filter(([, from]) => from.includes(status)).map(([action]) => action);

const PANEL = { REQUESTED: 'RETURN_REQUESTED', APPROVED: 'RETURN_APPROVED', REJECTED: 'RETURN_REJECTED', CANCELLED: 'RETURN_CANCELLED', REFUND_INITIATED: 'QC_PASSED', REFUND_COMPLETED: 'CLOSED' };
export const panelStatusOf = (status) => PANEL[status] ?? status;

/** An admin may cancel a return until the courier has the item (and one that was rejected, to let the customer ask again). */
export const ADMIN_CANCELLABLE = [S.REQUESTED, S.APPROVED, S.PICKUP_SCHEDULED, S.REJECTED];

export const REJECT_CODES = ['POLICY_NOT_MET', 'EVIDENCE_INSUFFICIENT', 'WINDOW_EXPIRED', 'OTHER'];
export const QC_FAIL_CODES = ['USED_OR_DAMAGED', 'MISSING_ACCESSORIES', 'WRONG_ITEM', 'SERIAL_MISMATCH'];

// ---- the customer's progress list: every step from the request to the refund, done, current or still to come.
const PATH = [S.REQUESTED, S.APPROVED, S.PICKUP_SCHEDULED, S.PICKED_UP, S.RECEIVED, S.QC_PASSED, S.REFUND_INITIATED, S.REFUND_COMPLETED];
const UPCOMING = Object.freeze({
  APPROVED: 'Seller approval', PICKUP_SCHEDULED: 'Pickup scheduled', PICKED_UP: 'Picked up from you', RECEIVED: 'Received by the seller',
  QC_PASSED: 'Quality check', REFUND_INITIATED: 'Refund initiated', REFUND_COMPLETED: 'Refund completed',
});
const ENDED_EARLY = [S.REJECTED, S.QC_FAILED, S.CANCELLED];

/**
 * [{ status, label, state: 'DONE' | 'CURRENT' | 'PENDING' | 'FAILED', at }] for `events` (the return's history, oldest first).
 * A return that is still going lists every step up to the refund; steps a return skipped (the seller marked it received
 * without a pickup scan, a refund that completed at once) count as done. One that ended early (rejected, cancelled, failed
 * QC) lists what happened and ends in the failure, with no steps to come.
 */
export function journeyOf(events) {
  const at = new Map(events.map((event) => [event.status, event.at.toISOString()]));
  if (ENDED_EARLY.includes(events.at(-1)?.status)) {
    return events.map((event, index) => ({ status: event.status, label: RETURN_LABELS[event.status] ?? event.status, state: index === events.length - 1 ? 'FAILED' : 'DONE', at: event.at.toISOString() }));
  }
  const reached = Math.max(...events.map((event) => PATH.indexOf(event.status)));
  return PATH.map((status, index) => {
    const state = index < reached || (index === reached && status === S.REFUND_COMPLETED) ? 'DONE' : index === reached ? 'CURRENT' : 'PENDING';
    return { status, label: state === 'PENDING' ? UPCOMING[status] : RETURN_LABELS[status], state, at: at.get(status) ?? null };
  });
}
