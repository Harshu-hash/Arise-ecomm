import { logger } from '../../../config/logger.js';
import { shippingGateway } from '../../../infrastructure/external/shipping/index.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { ADMIN_CANCELLABLE, panelStatusOf, PICKUP_CHASE_DAYS, qcDeadline, RETURN_STATUS as S, SELLER_FROM } from '../domain/services/returnRules.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { notifyReturnAutoApproved, notifyReturnCancelledByAdmin, notifyReturnAutoChecked, notifyReturnMoved } from './orderNotifications.js';
import { cancelPickup, schedulePickup } from './returnPickup.service.js';
import { settleReturn } from './returnSettlement.service.js';

// What can be done to a return, by whoever may do it. Callers (the seller's and the admin's services) check who the actor is
// and that the return is theirs to touch; these only know the rules. `actor` is { type: 'SELLER' | 'ADMIN', id }.

const FROM = { ...SELLER_FROM, override: [S.REJECTED], lapse: [S.PICKUP_SCHEDULED], cancel: ADMIN_CANCELLABLE }; // an admin can undo a seller's rejection; a pickup nobody makes lapses
const DONE = { approve: 'approved', reject: 'rejected', receive: 'marked received', qc: 'checked', override: 'reopened', lapse: 'cancelled', cancel: 'cancelled' };

/**
 * Moves the return to `to` if it is in one of the statuses `action` may start from. Asking again for where it already is does
 * nothing. The customer hears about it. Returns the return.
 */
async function move(returnId, action, to, actor, { set = {}, note = null } = {}) {
  const row = await Return.findById(returnId);
  if (!row) throw new NotFoundError('That return does not exist.');
  if (row.status === to) return row;
  const moved = await Return.findOneAndUpdate(
    { _id: row._id, status: { $in: FROM[action] } },
    { $set: { status: to, ...(to === S.RECEIVED ? { qcDueAt: qcDeadline() } : {}), ...set }, $push: { events: { status: to, at: new Date(), actorType: actor.type, actorId: actor.id ? String(actor.id) : null, note } } },
    { new: true },
  );
  if (!moved) throw new AppError({ code: 'ILLEGAL_TRANSITION', status: 409, message: `This return is ${panelStatusOf(row.status)} and cannot be ${DONE[action]} now.` });
  const order = await Order.findById(moved.orderId, 'number customerId');
  if (order) notifyReturnMoved(order, moved);
  return moved;
}

/** Books the courier right after an approval. A failure (Shiprocket down, an address missing) leaves the approval standing: "schedule pickup" retries. */
const bookCourier = (returnId) => schedulePickup(returnId).catch((err) => logger.warn({ err, returnId: String(returnId) }, 'Return approved but its pickup could not be booked yet'));

export async function approve(returnId, actor, note = null) {
  const row = await Return.findById(returnId, 'status');
  if (row?.status === S.PICKUP_SCHEDULED) return Return.findById(returnId); // approving again once the courier is booked changes nothing
  const approved = await move(returnId, 'approve', S.APPROVED, actor, { note });
  return approved.status === S.APPROVED ? bookCourier(returnId).then(() => Return.findById(returnId)) : approved;
}

/** An admin reopens a rejected return: it is approved and the courier is booked. */
export async function overrideRejection(returnId, reason, actor) {
  const row = await Return.findById(returnId, 'status decision');
  if ([S.APPROVED, S.PICKUP_SCHEDULED].includes(row?.status)) return Return.findById(returnId);
  await move(returnId, 'override', S.APPROVED, actor, { set: { decision: { ...row?.decision, overriddenBy: String(actor.id), overrideReason: reason, overriddenAt: new Date() } }, note: reason });
  await bookCourier(returnId);
  return Return.findById(returnId);
}

/** An admin cancels a return: it is closed, a booked pickup is cancelled, the item is free to be requested again and both sides are told why. No refund is made. */
export async function cancelReturnAsAdmin(returnId, reason, actor) {
  const before = await Return.findById(returnId, 'status');
  const cancelled = await move(returnId, 'cancel', S.CANCELLED, actor, { set: { active: false }, note: reason });
  if (before?.status !== S.CANCELLED) { // asking again for a cancelled return does nothing more
    await cancelPickup(cancelled);
    notifyReturnCancelledByAdmin(cancelled);
  }
  return Return.findById(returnId);
}

/** Books (or resumes booking) the courier for an approved return; a failure is told to the caller as it is. */
export const schedulePickupNow = (returnId) => schedulePickup(returnId);

export const reject = (returnId, { reasonCode, reason }, actor) =>
  move(returnId, 'reject', S.REJECTED, actor, { set: { decision: { reasonCode, reason, at: new Date() } }, note: reason });

export const receive = (returnId, actor) => move(returnId, 'receive', S.RECEIVED, actor);

/** The check of the returned item. A pass restocks it, refunds the customer and credits the invoice (a repeat after a failed refund carries on); a fail keeps the money and the customer is told why. */
export async function recordQc(returnId, { result, reasonCode, notes }, actor) {
  const checked = await move(returnId, 'qc', result === 'PASS' ? S.QC_PASSED : S.QC_FAILED, actor, { set: { qc: { result, reasonCode: result === 'FAIL' ? reasonCode : null, notes, at: new Date() } }, note: notes });
  return result === 'PASS' ? settleReturn(returnId) : checked;
}

/**
 * A seller who has not decided by the deadline (`decisionDueAt`) loses the say: the return is approved for them and the
 * courier booked, so a customer is never left waiting on a silent seller. Run on a schedule; safe to run twice at once
 * (a return a seller just decided is skipped). The seller is told. Returns how many it approved.
 */
export async function autoApproveOverdueReturns(now = new Date(), limit = 100) {
  const overdue = await Return.find({ status: S.REQUESTED, decisionDueAt: { $lte: now } }, '_id').sort({ decisionDueAt: 1 }).limit(limit).lean();
  let approved = 0;
  for (const { _id } of overdue) {
    try {
      const row = await approve(_id, { type: 'SYSTEM', id: null }, 'The seller did not respond by the deadline');
      if (row.status === S.REQUESTED) continue;
      approved += 1;
      notifyReturnAutoApproved(row);
    } catch (err) {
      logger.warn({ err, returnId: String(_id) }, 'Could not auto-approve an overdue return'); // e.g. the seller rejected it a moment ago
    }
  }
  return approved;
}

/**
 * A seller who has not checked a returned item by `qcDueAt` loses the say: the check counts as passed, so the customer is
 * refunded (and the item restocked) instead of waiting on a silent seller. Run on a schedule with autoApproveOverdueReturns;
 * safe to run twice at once. The seller is told. Returns how many it passed.
 */
export async function autoPassOverdueQc(now = new Date(), limit = 100) {
  const overdue = await Return.find({ status: S.RECEIVED, qcDueAt: { $lte: now } }, '_id').sort({ qcDueAt: 1 }).limit(limit).lean();
  let passed = 0;
  for (const { _id } of overdue) {
    try {
      const row = await recordQc(_id, { result: 'PASS', reasonCode: null, notes: 'The seller did not check it by the deadline' }, { type: 'SYSTEM', id: null });
      passed += 1;
      notifyReturnAutoChecked(row);
    } catch (err) {
      logger.warn({ err, returnId: String(_id) }, 'Could not auto-pass an overdue QC'); // e.g. the seller recorded it a moment ago
    }
  }
  return passed;
}

const STUCK_MS = 15 * 60_000; // an approval whose courier booking has not gone through for this long is retried

/**
 * Looks after pickups on a schedule (with the deadline jobs above). An approved return whose courier could not be booked
 * is booked again (it resumes where it stopped). A booked pickup nobody collected by `pickupDueAt` is chased once (the courier
 * is asked again and gets a few more days); if it still is not collected the return lapses: cancelled, the customer told, the
 * item free to be requested again while its window is open. Safe to run twice at once. Returns { booked, chased, lapsed }.
 */
export async function chasePickups(now = new Date(), limit = 100) {
  const counts = { booked: 0, chased: 0, lapsed: 0 };
  const stuck = await Return.find({ status: S.APPROVED, updatedAt: { $lte: new Date(now.getTime() - STUCK_MS) } }, '_id').limit(limit).lean();
  for (const { _id } of stuck) {
    try {
      if ((await schedulePickup(_id)).status === S.PICKUP_SCHEDULED) counts.booked += 1;
    } catch (err) {
      logger.warn({ err, returnId: String(_id) }, 'Could not book a pickup for an approved return yet');
    }
  }
  const due = await Return.find({ status: S.PICKUP_SCHEDULED, 'reverse.pickupDueAt': { $lte: now } }).limit(limit);
  for (const row of due) {
    try {
      if (!row.reverse.chased) {
        await shippingGateway.requestPickup(row.reverse.providerShipmentId);
        await Return.updateOne({ _id: row._id, 'reverse.chased': false }, { $set: { 'reverse.chased': true, 'reverse.pickupDueAt': new Date(now.getTime() + PICKUP_CHASE_DAYS * 86_400_000) } });
        counts.chased += 1;
      } else {
        await move(row._id, 'lapse', S.CANCELLED, { type: 'SYSTEM', id: null }, { set: { active: false }, note: 'The courier could not collect it' });
        await cancelPickup(row);
        counts.lapsed += 1;
      }
    } catch (err) {
      logger.warn({ err, returnId: String(row._id) }, 'Could not chase an overdue return pickup');
    }
  }
  return counts;
}
