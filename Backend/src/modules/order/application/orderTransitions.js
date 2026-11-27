import { withTransaction } from '../../../config/database.js';
import { logger } from '../../../config/logger.js';
import { orderChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { reverseOrderPlaced } from '../../coupon/public/index.js';
import { refundPayment } from '../../payment/public/index.js';
import { returnStock } from '../../product/public/index.js';
import { itemsPaidPaise } from '../domain/services/orderMoney.js';
import { deriveOrderStatus, isCancellable, SUB } from '../domain/services/orderStatus.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { issueCreditNotes } from './invoice.service.js';
import { accrueDelivered } from '../../settlement/public/index.js';
import { qualifyOnDelivered } from '../../referral/public/index.js';
import { grantCashback } from '../../wallet/public/index.js';
import { notifyCancelled, notifyRefundProcessed, notifySubOrderMoved } from './orderNotifications.js';
import { stockReference } from './checkout.service.js';

// The only places an order's or a parcel's status changes after it is placed. The order's own status is never set by hand:
// it is derived from its parcels (deriveOrderStatus) every time one of them moves.

/** Who did it, for the history: { type: 'SELLER' | 'CUSTOMER' | 'COURIER' | 'SYSTEM', id? }. */
export const actorOf = (type, id = null) => ({ type, id: id ? String(id) : null });

/** Brings the order's status (and its customer-facing timeline) in line with its parcels. */
async function syncOrderStatus(order) {
  const derived = deriveOrderStatus(order.subOrders.map((sub) => sub.status));
  if (derived === order.status) return;
  // conditional on the status we saw, so two parcels moving at once record the change once
  await Order.updateOne({ _id: order._id, status: order.status }, { $set: { status: derived }, $push: { timeline: { status: derived, at: new Date(), note: null } } });
}

/**
 * Moves one parcel to `to`, only if it is currently in one of `from` (any status but CANCELLED when omitted).
 * Returns the order, or null when the parcel was not in a status that allows it (so double clicks and late
 * courier updates do nothing).
 */
export async function moveSubOrder({ orderId, subOrderId, to, from = null, actor, note = null }) {
  const moved = await Order.findOneAndUpdate(
    { _id: orderId, subOrders: { $elemMatch: { _id: subOrderId, status: from ? { $in: from } : { $ne: SUB.CANCELLED } } } },
    { $set: { 'subOrders.$.status': to, ...(to === SUB.DELIVERED ? { 'subOrders.$.deliveredAt': new Date() } : {}) }, $push: { 'subOrders.$.events': { status: to, at: new Date(), actorType: actor.type, actorId: actor.id, note } } },
    { new: true },
  );
  if (!moved) return null;
  await syncOrderStatus(moved);
  const order = await Order.findById(orderId);
  orderChanged(order);
  notifySubOrderMoved(order, subOrderId, to);
  if (to === SUB.DELIVERED) {
    await accrueDelivered(orderId, subOrderId); // credits the seller's wallet; never throws into the delivery
    await qualifyOnDelivered(order); // an invited friend's first qualifying order earns the referral reward; never throws either
    await grantCashback({ userId: order.customerId, orderNumber: order.number, subOrderId, valuePaise: itemsPaidPaise(order.subOrders.id(subOrderId) ?? { items: [] }) }); // the best cashback rule, once per parcel
  }
  return order;
}

const notCancellable = () => new AppError({ code: 'ORDER_NOT_CANCELLABLE', status: 409, message: 'This order has already been handed to a courier and can no longer be cancelled.' });

/** What a customer cancelling their order cancels: every live parcel, and only if none is past the cancellable point. */
export function allLiveParcels(order) {
  const live = order.subOrders.filter((sub) => sub.status !== SUB.CANCELLED);
  if (live.some((sub) => !isCancellable(sub.status))) throw notCancellable();
  return live;
}

/** What a seller cancelling their part cancels: that parcel, if it is theirs and still cancellable. */
export const oneParcel = (sellerId, subOrderId) => (order) => {
  const sub = order.subOrders.id(subOrderId);
  if (!sub || sub.sellerId !== String(sellerId)) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'That order is not on your account.' });
  if (sub.status === SUB.CANCELLED) return [];
  if (!isCancellable(sub.status)) throw new AppError({ code: 'NOT_CANCELLABLE', status: 409, message: 'This order can no longer be cancelled: it has already been made ready to ship.' });
  return [sub];
};

/**
 * Cancels the parcels `pick(order)` chooses, in one transaction: each goes back on sale (its own lines only), the order's
 * status follows, and when none is left the coupon use is given back. Then the customer is refunded what those parcels
 * cost (plus the platform fee when nothing is left), which is retried safely by key. If Razorpay refuses, the cancellation
 * stands and the failed refund is recorded on the payment for ops. Asking again for something already cancelled does nothing.
 * Returns the order.
 */
export async function cancelParcels(orderId, { pick, actor, note = null }) {
  const outcome = await withTransaction(async (s) => {
    const order = await Order.findById(orderId).session(s);
    if (!order) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'This order does not exist.' });
    const targets = pick(order);
    if (!targets.length) return { order, refundPaise: 0, key: null, cancelled: [] };

    const at = new Date();
    for (const sub of targets) {
      sub.status = SUB.CANCELLED;
      sub.events.push({ status: SUB.CANCELLED, at, actorType: actor.type, actorId: actor.id, note });
    }
    await returnStock({ reference: stockReference({ _id: order.checkoutSessionId }), offerIds: targets.flatMap((sub) => sub.items.map((item) => item.offerId)) }, s);
    const none = order.subOrders.every((sub) => sub.status === SUB.CANCELLED);
    const derived = deriveOrderStatus(order.subOrders.map((sub) => sub.status));
    if (derived !== order.status) {
      order.status = derived;
      order.timeline.push({ status: derived, at, note });
    }
    if (none) {
      order.cancelReason = note;
      await reverseOrderPlaced({ orderId: order._id }, s);
    }
    await order.save({ session: s });
    return {
      order,
      // cash on delivery: nothing was collected before delivery, so there is nothing to give back
      refundPaise: order.paymentMethod === 'cod' ? 0 : targets.reduce((sum, sub) => sum + sub.payablePaise, 0) + (none ? order.totals.platformFeePaise : 0),
      key: `cancel:${targets.map((sub) => sub._id).join(',')}`,
      cancelled: targets.map((sub) => String(sub._id)),
    };
  });

  if (outcome.refundPaise > 0) {
    try {
      const paid = await refundPayment(outcome.order.paymentId, { key: outcome.key, amountPaise: outcome.refundPaise, reason: note ?? 'Order cancelled' });
      await Order.updateOne({ _id: orderId }, { $inc: { refundedPaise: outcome.refundPaise } });
      await notifyRefundProcessed(outcome.order, paid.refunds.find((refund) => refund.key === outcome.key));
    } catch (err) {
      logger.error({ err, orderId: String(orderId), key: outcome.key }, 'Refund for a cancellation failed; it is recorded on the payment for retry');
    }
  }
  const order = await Order.findById(orderId);
  // A parcel that was already invoiced (only an admin can cancel one that far) is reversed by a credit note.
  if (outcome.cancelled.length) await issueCreditNotes(orderId, outcome.cancelled, { withFee: order.subOrders.every((sub) => sub.status === SUB.CANCELLED), reason: note ?? 'Order cancelled' });
  if (outcome.cancelled.length) orderChanged(order);
  if (outcome.cancelled.length) notifyCancelled({ order, subs: order.subOrders.filter((sub) => outcome.cancelled.includes(String(sub._id))), actor, refundPaise: outcome.refundPaise });
  return order;
}

const RTO_FROM = [SUB.READY_TO_SHIP, SUB.SHIPPED, SUB.IN_TRANSIT, SUB.OUT_FOR_DELIVERY, SUB.DELIVERY_FAILED, SUB.RTO];

/**
 * An undelivered parcel is back with the seller (Shiprocket's "RTO delivered"; an admin may also say so): its units go back on
 * sale, the customer is refunded what the items cost (delivery and platform fees stay: the courier was still paid), and an
 * already issued invoice is credited for the goods. Only the first call acts; a refund Razorpay refuses is recorded on the
 * payment for retry, like a cancellation's. Returns the order, or null when the parcel was not in a status that allows it.
 */
export async function receiveRto({ orderId, subOrderId, actor, note = 'Returned to the seller' }) {
  const moved = await moveSubOrder({ orderId, subOrderId, to: SUB.RTO_DELIVERED, from: RTO_FROM, actor, note });
  if (!moved) return null;
  const sub = moved.subOrders.id(subOrderId);
  await returnStock({ reference: stockReference({ _id: moved.checkoutSessionId }), offerIds: sub.items.map((item) => item.offerId), type: 'RTO' });
  const refundPaise = moved.paymentMethod === 'cod' ? 0 : itemsPaidPaise(sub); // cash on delivery: the customer never paid
  if (refundPaise > 0) {
    try {
      await refundPayment(moved.paymentId, { key: `rto:${subOrderId}`, amountPaise: refundPaise, reason: note });
      await Order.updateOne({ _id: orderId }, { $inc: { refundedPaise: refundPaise } });
    } catch (err) {
      logger.error({ err, orderId: String(orderId), subOrderId: String(subOrderId) }, 'Refund for a returned parcel failed; it is recorded on the payment for retry');
    }
  }
  await issueCreditNotes(orderId, [subOrderId], { reason: note, goodsOnly: true });
  const order = await Order.findById(orderId);
  orderChanged(order);
  return order;
}
