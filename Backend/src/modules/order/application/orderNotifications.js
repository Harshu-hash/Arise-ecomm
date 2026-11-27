import { logger } from '../../../config/logger.js';
import { returnChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { enqueueEmail } from '../../../infrastructure/queue/notification.queue.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getCustomerContact } from '../../identity/public/index.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { itemsPaidPaise } from '../domain/services/orderMoney.js';
import { SUB } from '../domain/services/orderStatus.js';

// Who hears about what, as an order moves. Every function here is called after the change it describes has committed, and
// none of them can fail the caller: a notification problem is logged, never thrown. Each message has a key naming its event,
// so an event that is handled twice tells the person once.

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const orderTarget = (order) => ({ type: 'ORDER', entityId: String(order._id) });
const names = (subs) => subs.flatMap((sub) => sub.items.map((item) => item.name)).join(', ');

const email = (to, subject, lines) => (to ? { to, subject, text: lines.join('\n\n'), html: lines.map((line) => `<p>${line}</p>`).join('') } : null);

async function toCustomer(order, message) {
  const contact = await getCustomerContact(order.customerId);
  return notify({ to: { type: 'CUSTOMER', id: order.customerId }, target: orderTarget(order), ...message, email: message.mail ? email(contact?.email, message.mail.subject, [`Hi ${contact?.name ?? 'there'},`, ...message.mail.lines]) : null });
}

const quietly = (work, what) => work().catch((err) => logger.error({ err }, `Could not send ${what} notifications`));

/** The order was paid for and placed: the customer gets a confirmation (and email), each seller a new-order alert. */
export const notifyOrderPlaced = (order) => quietly(async () => {
  const items = order.subOrders.reduce((sum, sub) => sum + sub.items.length, 0);
  await toCustomer(order, {
    category: CATEGORY.ORDER,
    key: `order-placed:${order._id}`,
    title: 'Order confirmed',
    body: `Your order ${order.number} for ${rupees(order.totals.payablePaise)} is confirmed.${order.paymentMethod === 'cod' ? ' Pay in cash when it arrives.' : ''}`,
    mail: { subject: `Order ${order.number} confirmed`, lines: [`Thanks for your order. ${items} item${items === 1 ? '' : 's'}, total ${rupees(order.totals.payablePaise)}, to be delivered to ${order.address.line}, ${order.address.city} ${order.address.pincode}.`, `Order number: ${order.number}`, ...(order.paymentMethod === 'cod' ? ['You chose cash on delivery: please pay the courier when your order arrives.'] : [])] },
  });
  await Promise.all(order.subOrders.map((sub) => notify({
    to: { type: 'SELLER', id: sub.sellerId },
    category: CATEGORY.ORDER,
    key: `new-order:${sub._id}`,
    title: 'New order to ship',
    body: `${sub.items.length} item${sub.items.length === 1 ? '' : 's'} worth ${rupees(sub.payablePaise)} for ${order.address.city}. Accept it to start.`,
    link: `/orders/${sub._id}`,
  })));
}, 'order-placed');

const PROGRESS = {
  [SUB.RTO_DELIVERED]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Refund on its way', body: `Your items from ${sub.sellerName} (order ${order.number}) came back to the seller. ${rupees(itemsPaidPaise(sub))} is being refunded to your original payment method.`, mail: { subject: `Refund for order ${order.number}`, lines: [`Your items from ${sub.sellerName} could not be delivered and are back with the seller: ${names([sub])}.`, `${rupees(itemsPaidPaise(sub))} is being refunded to your original payment method.`] } }),
  [SUB.READY_TO_SHIP]: (order, sub) => ({ category: CATEGORY.ORDER, title: 'Ready to ship', body: `${sub.sellerName} has packed your items from order ${order.number}. The courier will collect them soon.` }),
  [SUB.SHIPPED]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Order shipped', body: `Your items from ${sub.sellerName} (order ${order.number}) are on their way.`, mail: { subject: `Order ${order.number} has shipped`, lines: [`Your items from ${sub.sellerName} have been handed to the courier: ${names([sub])}.`] } }),
  [SUB.OUT_FOR_DELIVERY]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Out for delivery', body: `Your items from ${sub.sellerName} (order ${order.number}) arrive today.` }),
  [SUB.DELIVERED]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Delivered', body: `Your items from ${sub.sellerName} (order ${order.number}) were delivered.`, mail: { subject: `Order ${order.number} delivered`, lines: [`Your items from ${sub.sellerName} were delivered: ${names([sub])}.`] } }),
  [SUB.DELIVERY_FAILED]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Delivery attempt failed', body: `The courier could not deliver your items from ${sub.sellerName} (order ${order.number}). They will try again.` }),
  [SUB.RTO]: (order, sub) => ({ category: CATEGORY.DELIVERY, title: 'Order being returned', body: `Your items from ${sub.sellerName} (order ${order.number}) could not be delivered and are going back to the seller.` }),
};

/** A parcel moved to `to`: the customer hears about the steps that matter to them. */
export const notifySubOrderMoved = (order, subOrderId, to) => quietly(async () => {
  const sub = order.subOrders.id(subOrderId);
  const message = sub && PROGRESS[to]?.(order, sub);
  if (message) await toCustomer(order, { ...message, key: `sub:${sub._id}:${to}` });
}, 'order-progress');

/**
 * Parcels were cancelled. `actor` is who did it; `refundPaise` what goes back to the customer. The customer is told by
 * either route; sellers are told when the customer was the one cancelling.
 */
export const notifyCancelled = ({ order, subs, actor, refundPaise }) => quietly(async () => {
  const key = `cancel:${subs.map((sub) => sub._id).join(',')}`;
  const refundLine = refundPaise > 0 ? `${rupees(refundPaise)} will be refunded to your original payment method.` : '';
  if (actor.type !== 'CUSTOMER') {
    const by = actor.type === 'SELLER' ? subs[0].sellerName : 'Arise';
    await toCustomer(order, {
      category: CATEGORY.ORDER, key, title: 'Part of your order was cancelled',
      body: `${by} cancelled ${names(subs)} from order ${order.number}. ${refundLine}`.trim(),
      mail: { subject: `Part of order ${order.number} was cancelled`, lines: [`${by} could not fulfil ${names(subs)}.`, refundLine].filter(Boolean) },
    });
    if (actor.type === 'ADMIN') {
      await Promise.all(subs.map((sub) => notify({
        to: { type: 'SELLER', id: sub.sellerId }, category: CATEGORY.ORDER, key: `cancelled:${sub._id}`, severity: 'warning',
        title: 'Order cancelled by Arise', body: `Order ${order.number} (${names([sub])}) was cancelled by Arise support. Do not ship it.`, link: `/orders/${sub._id}`,
      })));
    }
  } else {
    await toCustomer(order, {
      category: CATEGORY.ORDER, key, title: 'Order cancelled',
      body: `Your order ${order.number} was cancelled. ${refundLine}`.trim(),
      mail: { subject: `Order ${order.number} cancelled`, lines: [`Your order ${order.number} was cancelled.`, refundLine].filter(Boolean) },
    });
    await Promise.all(subs.map((sub) => notify({
      to: { type: 'SELLER', id: sub.sellerId }, category: CATEGORY.ORDER, key: `cancelled:${sub._id}`, severity: 'warning',
      title: 'Order cancelled by customer', body: `Order ${order.number} (${names([sub])}) was cancelled. Do not ship it.`, link: `/orders/${sub._id}`,
    })));
  }
}, 'cancellation');

/** A cancellation's refund was issued: says where the money went (card/UPI/bank and/or the wallet), which the cancellation message could only promise. */
export const notifyRefundProcessed = (order, refund) => quietly(async () => {
  if (!refund) return;
  const parts = [refund.amountPaise > 0 && `${rupees(refund.amountPaise)} to your original payment method (it can take 5-7 working days to show up)`, refund.walletPaise > 0 && `${rupees(refund.walletPaise)} to your Arise wallet`].filter(Boolean);
  if (!parts.length) return;
  await toCustomer(order, { category: CATEGORY.ORDER, key: `refund-processed:${order._id}:${refund.key}`, title: 'Refund processed', body: `We refunded ${parts.join(' and ')} for your cancelled order ${order.number}.` });
}, 'refund-processed');

/** Paid, but the stock sold out before the order could be placed: the payment is being refunded. */
export const notifyUnfulfillable = ({ customerId, sessionId, amountPaise }) => quietly(async () => {
  const contact = await getCustomerContact(customerId);
  await notify({
    to: { type: 'CUSTOMER', id: customerId }, category: CATEGORY.ORDER, key: `unfulfillable:${sessionId}`,
    title: 'We could not complete your order',
    body: amountPaise ? `Some items sold out before your payment completed. ${rupees(amountPaise)} is being refunded.` : 'Some items sold out before your order could be placed. Nothing was charged.',
    email: email(contact?.email, 'We could not complete your order', [`Hi ${contact?.name ?? 'there'},`, amountPaise ? `Some items sold out before your payment completed, so we could not place your order. ${rupees(amountPaise)} is being refunded to your original payment method.` : 'Some items sold out before your order could be placed. Nothing was charged.']),
  });
}, 'unfulfillable-order');

/** A tax document was issued for the customer's order: an in-app notice (the invoice itself is downloaded from the order). */
export const notifyInvoiceIssued = (order, invoice) => quietly(() => toCustomer(order, {
  category: CATEGORY.ORDER,
  key: `invoice:${invoice._id}`,
  title: invoice.docType === 'CREDIT_NOTE' ? 'Credit note issued' : 'Invoice ready',
  body: invoice.docType === 'CREDIT_NOTE' ? `Credit note ${invoice.number} was issued for order ${order.number}.` : `Your invoice ${invoice.number} for order ${order.number} is ready to download.`,
}), 'invoice');

/** Emails the customer a download link for one document (an admin "resend"). */
export const emailInvoiceLink = (order, invoice, link) => quietly(() => toCustomer(order, {
  category: CATEGORY.ORDER,
  key: `invoice-resend:${invoice._id}:${Date.now()}`,
  title: 'Your invoice',
  body: `Your ${invoice.docType === 'CREDIT_NOTE' ? 'credit note' : 'invoice'} ${invoice.number} for order ${order.number} is ready.`,
  mail: { subject: `${invoice.docType === 'CREDIT_NOTE' ? 'Credit note' : 'Invoice'} ${invoice.number} for order ${order.number}`, lines: [`Download it here (the link works for 7 days): <a href="${link}">${invoice.number}</a>`] },
}), 'invoice-resend');

/** A customer asked to return an item: the seller is told in their bell, with the time they have to decide. */
export const notifyReturnRequested = (ret) => quietly(() => notify({
  to: { type: 'SELLER', id: ret.sellerId }, category: CATEGORY.ORDER, key: `return-requested:${ret._id}`, severity: 'warning',
  title: 'New return request', body: `${ret.productName} from order ${ret.orderNumber}. Approve or reject it by ${ret.decisionDueAt.toISOString().slice(0, 10)}.`, link: `/returns/${ret._id}`,
}), 'return-requested');

const RETURN_PROGRESS = {
  APPROVED: (order, ret) => ({ title: 'Return approved', body: `Your return of ${ret.productName} (order ${order.number}) was approved. We will arrange the pickup.` }),
  REJECTED: (order, ret) => ({ title: 'Return not approved', body: `Your return of ${ret.productName} (order ${order.number}) was not approved: ${ret.decision?.reason ?? 'the seller declined it'}.` }),
  PICKUP_SCHEDULED: (order, ret) => ({ title: 'Pickup scheduled', body: `${ret.reverse?.courierName ?? 'The courier'} will collect ${ret.productName} (order ${order.number}) from your pickup address. Tracking number ${ret.reverse?.awb}.` }),
  CANCELLED: (order, ret) => (ret.events.at(-1)?.actorType === 'ADMIN'
    ? { title: 'Return cancelled', body: `Your return of ${ret.productName} (order ${order.number}) was cancelled by Arise: ${ret.events.at(-1).note}. You can request it again while the return window is open.` }
    : { title: 'Return cancelled', body: `The courier could not collect ${ret.productName} (order ${order.number}), so the return was cancelled. You can request it again while the return window is open.` }),
  PICKED_UP: (order, ret) => ({ title: 'Return picked up', body: `${ret.productName} (order ${order.number}) was collected and is on its way back to the seller.` }),
  RECEIVED: (order, ret) => ({ title: 'Return received', body: `The seller received ${ret.productName} (order ${order.number}) and will check it now.` }),
  QC_PASSED: (order, ret) => ({ title: 'Return accepted', body: `${ret.productName} (order ${order.number}) passed the check. ${rupees(ret.amountPaise)} will be refunded to your original payment method.` }),
  REFUND_INITIATED: (order, ret) => ({ title: 'Refund initiated', body: `${rupees(ret.amountPaise)} for ${ret.productName} (order ${order.number}) is on its way to your original payment method.` }),
  REFUND_COMPLETED: (order, ret) => ({ title: 'Refund completed', body: `${rupees(ret.amountPaise)} for ${ret.productName} (order ${order.number}) was refunded to your original payment method.`, mail: { subject: `Refund for order ${order.number}`, lines: [`${rupees(ret.amountPaise)} for ${ret.productName} was refunded to your original payment method.`] } }),
  QC_FAILED: (order, ret) => ({ title: 'Return not accepted', body: `${ret.productName} (order ${order.number}) did not pass the check: ${ret.qc?.notes ?? 'condition not acceptable'}. Contact support if you disagree.` }),
};

/** The seller moved a return along: the customer hears about the steps that matter to them. */
export const notifyReturnMoved = (order, ret) => quietly(async () => {
  returnChanged(ret); // every step a return takes comes through here, so the live-update hint rides along
  const message = RETURN_PROGRESS[ret.status]?.(order, ret);
  if (message) await toCustomer(order, { category: CATEGORY.ORDER, key: `return:${ret._id}:${ret.status}`, ...message });
}, 'return-progress');

/** The customer withdrew a return the seller had approved: they are told not to expect the item. */
export const notifyReturnWithdrawn = (ret) => quietly(() => notify({
  to: { type: 'SELLER', id: ret.sellerId }, category: CATEGORY.ORDER, key: `return-withdrawn:${ret._id}`,
  title: 'Return withdrawn by customer', body: `The customer withdrew the return of ${ret.productName} (order ${ret.orderNumber}). Do not expect it back.`, link: `/returns/${ret._id}`,
}), 'return-withdrawn');

/** The seller missed the deadline to decide on a return, so it was approved for them. */
export const notifyReturnAutoApproved = (ret) => quietly(() => notify({
  to: { type: 'SELLER', id: ret.sellerId }, category: CATEGORY.ORDER, key: `return-auto-approved:${ret._id}`, severity: 'warning',
  title: 'Return approved automatically', body: `You did not decide on the return of ${ret.productName} (order ${ret.orderNumber}) in time, so it was approved and a pickup arranged.`, link: `/returns/${ret._id}`,
}), 'return-auto-approved');

/** The seller missed the deadline to check a returned item, so the check counted as passed and the customer was refunded. */
export const notifyReturnAutoChecked = (ret) => quietly(() => notify({
  to: { type: 'SELLER', id: ret.sellerId }, category: CATEGORY.ORDER, key: `return-auto-checked:${ret._id}`, severity: 'warning',
  title: 'Return accepted automatically', body: `You did not check the returned ${ret.productName} (order ${ret.orderNumber}) in time, so it was accepted and ${rupees(ret.amountPaise)} refunded to the customer.`, link: `/returns/${ret._id}`,
}), 'return-auto-checked');

/**
 * A cancelled return's courier booking could not be cancelled on Shiprocket: the platform's support address (Settings > General)
 * is emailed once so someone cancels it by hand (or retries from the console) before the courier turns up for nothing.
 * Returns whether the email was queued.
 */
export async function notifyOpsPickupCancelFailed(ret, error) {
  try {
    const { supportEmail, platformName } = await getSettingsSection('general');
    if (!supportEmail) return false;
    const lines = [
      `The return ${ret.number} (order ${ret.orderNumber}) was cancelled, but its courier pickup could not be cancelled on Shiprocket.`,
      `Courier: ${ret.reverse.courierName ?? 'unknown'}. Tracking number: ${ret.reverse.awb}. Shiprocket said: ${error}`,
      'Cancel the shipment in the Shiprocket dashboard, or retry from the admin console (POST /api/admin/v1/returns/:id/cancel-pickup), so the courier does not turn up for nothing.',
    ];
    await enqueueEmail({ to: supportEmail, subject: `[${platformName}] Cancel a courier pickup: return ${ret.number}`, text: lines.join('\n\n'), html: lines.map((line) => `<p>${line}</p>`).join(''), dedupeKey: `return-cancel-failed-${ret._id}` });
    return true;
  } catch (err) {
    logger.error({ err, returnId: String(ret._id) }, 'Could not email ops about a pickup that failed to cancel');
    return false;
  }
}

/** An admin cancelled a return: the seller is told not to expect the item (the customer hears through notifyReturnMoved). */
export const notifyReturnCancelledByAdmin = (ret) => quietly(() => notify({
  to: { type: 'SELLER', id: ret.sellerId }, category: CATEGORY.ORDER, key: `return-cancelled-by-admin:${ret._id}`, severity: 'warning',
  title: 'Return cancelled by Arise', body: `The return of ${ret.productName} (order ${ret.orderNumber}) was cancelled by Arise support. Do not expect it back.`, link: `/returns/${ret._id}`,
}), 'return-cancelled-by-admin');
