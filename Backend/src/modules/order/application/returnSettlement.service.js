import { logger } from '../../../config/logger.js';
import { orderChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { Payment, refundPayment } from '../../payment/public/index.js';
import { returnStock } from '../../product/public/index.js';
import { RETURN_STATUS } from '../domain/services/returnRules.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { stockReference } from './checkout.service.js';
import { issueReturnCreditNote } from './invoice.service.js';
import { reverseForReturn } from '../../settlement/public/index.js';
import { notifyReturnMoved } from './orderNotifications.js';

// The money side of a return: what happens once the seller's QC passes.

const KEY_PREFIX = 'return:';
const event = (status) => ({ status, at: new Date(), actorType: 'SYSTEM', actorId: null, note: null });

/**
 * A return passed QC: the item goes back on sale, the customer gets the item's price back to the original payment (nothing
 * else: no delivery or platform fee), and the invoice's line for it is credited. Every part is safe to repeat, so calling it
 * again after a failure carries on; a refund Razorpay refuses is left on the payment for retry and the return stays QC_PASSED.
 * Returns the return as it now stands.
 */
export async function settleReturn(returnId) {
  const ret = await Return.findById(returnId);
  if (!ret || ![RETURN_STATUS.QC_PASSED, RETURN_STATUS.REFUND_INITIATED].includes(ret.status)) return ret;
  const order = await Order.findById(ret.orderId);
  const item = order.subOrders.id(ret.subOrderId).items.id(ret.itemId);
  await returnStock({ reference: stockReference({ _id: order.checkoutSessionId }), offerIds: [item.offerId], type: 'RETURN' });

  const key = `${KEY_PREFIX}${ret._id}`;
  try {
    const payment = await refundPayment(order.paymentId, { key, amountPaise: ret.amountPaise, reason: 'Item returned' });
    const done = payment.refunds.find((refund) => refund.key === key).status === 'SUCCEEDED';
    const status = done ? RETURN_STATUS.REFUND_COMPLETED : RETURN_STATUS.REFUND_INITIATED;
    // only the call that records the refund counts it on the order, so a repeat never counts it twice
    const recorded = await Return.findOneAndUpdate(
      { _id: ret._id, 'refund.key': null },
      { $set: { status, 'refund.key': key, 'refund.status': done ? 'SUCCEEDED' : 'PROCESSING', 'refund.failureReason': null }, $push: { events: event(status) } },
      { new: true },
    );
    if (recorded) {
      await Order.updateOne({ _id: order._id }, { $inc: { refundedPaise: ret.amountPaise } });
      notifyReturnMoved(order, recorded);
    }
  } catch (err) {
    logger.error({ err, returnId: String(ret._id) }, 'Refund for a returned item failed; it is recorded on the payment for retry');
    await Return.updateOne({ _id: ret._id, 'refund.key': null }, { $set: { 'refund.status': 'FAILED', 'refund.failureReason': String(err.cause?.message ?? err.message).slice(0, 300) } });
  }
  await issueReturnCreditNote(order._id, ret.subOrderId, ret.itemId, ret._id, 'Item returned');
  if ((await Return.findById(ret._id, 'refund.key').lean()).refund.key) await reverseForReturn(ret.itemId); // the refund was made: the seller gives the money back (a refused refund reverses nothing; a retry comes back here)
  orderChanged(await Order.findById(order._id));
  return Return.findById(ret._id);
}

/** Razorpay says a refund was processed or failed: a return's refund follows it. Refunds of cancellations and RTOs are not returns and do nothing here. */
export async function syncReturnRefund({ providerRefundId, providerStatus }) {
  const payment = await Payment.findOne({ 'refunds.providerRefundId': providerRefundId }, 'refunds').lean();
  const key = payment?.refunds.find((refund) => refund.providerRefundId === providerRefundId)?.key;
  if (!key?.startsWith(KEY_PREFIX)) return;
  const returnId = key.slice(KEY_PREFIX.length);
  if (providerStatus === 'processed') {
    const done = await Return.findOneAndUpdate(
      { _id: returnId, status: RETURN_STATUS.REFUND_INITIATED },
      { $set: { status: RETURN_STATUS.REFUND_COMPLETED, 'refund.status': 'SUCCEEDED' }, $push: { events: event(RETURN_STATUS.REFUND_COMPLETED) } },
      { new: true },
    );
    const order = done && await Order.findById(done.orderId, 'number customerId');
    if (order) notifyReturnMoved(order, done);
  } else if (providerStatus === 'failed') {
    await Return.updateOne({ _id: returnId, 'refund.status': 'PROCESSING' }, { $set: { 'refund.status': 'FAILED' } });
  }
}
