import { randomBytes } from 'node:crypto';
import { withTransaction } from '../../../config/database.js';
import { logger } from '../../../config/logger.js';
import { orderChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { paymentGateway } from '../../../infrastructure/external/payment/index.js';
import { registerWebhookHandler } from '../../../infrastructure/webhooks/webhookProcessor.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { removeOrderedItems } from '../../cart/public/index.js';
import { recordOrderPlaced } from '../../coupon/public/index.js';
import { findCommittedPayment, Payment, recordCapture, recordFailure, recordRefund, refundPayment } from '../../payment/public/index.js';
import { commitStock } from '../../product/public/index.js';
import { canAdvance, getShipment, getShipmentsBySubOrder, recordTracking, SHIPROCKET, TRACKING_EVENT } from '../../shipping/public/index.js';
import { CheckoutSession, SESSION_STATUS } from '../infrastructure/persistence/checkoutSession.model.js';
import { Order, ORDER_STATUS } from '../infrastructure/persistence/order.model.js';
import { allocate } from '../domain/services/orderMoney.js';
import { isCodCollected, SUB } from '../domain/services/orderStatus.js';
import { returnState } from '../domain/services/returnRules.js';
import { itemsWithReturn } from './return.service.js';
import { recordReturnTracking } from './returnPickup.service.js';
import { syncReturnRefund } from './returnSettlement.service.js';
import { stockReference } from './checkout.service.js';
import { notifyOrderPlaced, notifyUnfulfillable } from './orderNotifications.js';
import { actorOf, allLiveParcels, cancelParcels, moveSubOrder, receiveRto } from './orderTransitions.js';

// Orders. An order is created only after the payment succeeded, from the quote the customer paid for, in one transaction
// with the stock sale, so there is never an order without stock taken or stock taken without an order. Placing is safe to
// repeat and is triggered from three places (the app, the confirm call, Razorpay's webhook): whichever comes first wins.

const failure = (status, code, message) => new AppError({ code, message, status });
class Unfulfillable extends Error {}

const orderNumber = () => `ARS${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

const toItemDoc = (line) => ({
  offerId: line.offerId, productId: line.productId, variantId: line.variantId, name: line.name, brand: line.brand, category: line.category,
  variantLabel: line.variantLabel, imageUrl: line.imageUrl, quantity: line.quantity, unitPricePaise: line.unitPricePaise, mrpPaise: line.mrpPaise,
  amountPaise: line.amountPaise, discountPaise: line.discountPaise, hsnCode: line.hsnCode, gstRate: line.gstRate, gstPaise: line.gstPaise,
  commissionPct: line.commissionPct, commissionPaise: line.commissionPaise, priceSource: line.priceSource, returnWindowDays: line.returnWindowDays,
});

/**
 * Turns a paid checkout into an order. `customerId` (from the app's call) must own the checkout; the webhook passes none.
 * Throws 409 PAYMENT_NOT_COMPLETED if nothing was paid, and 409 ORDER_UNFULFILLABLE (after refunding) when the paid-for
 * stock was already given away, which happens only when a payment lands after the checkout window ran out.
 */
export async function placeOrder({ sessionId, customerId = null }) {
  const session = await CheckoutSession.findById(sessionId);
  if (!session || (customerId && session.customerId !== String(customerId))) throw new NotFoundError('This checkout does not exist.');
  const existing = await Order.findOne({ checkoutSessionId: session._id });
  if (existing) return existing;
  const payment = await findCommittedPayment(session._id);
  if (!payment) throw failure(409, 'PAYMENT_NOT_COMPLETED', 'Payment for this checkout has not been completed.');
  const { quote } = session;
  if (payment.amountPaise !== quote.totals.payablePaise) {
    throw failure(409, 'PAYMENT_AMOUNT_MISMATCH', 'The amount paid does not match this checkout.');
  }

  // cash on delivery: the courier collects each parcel's payable plus its share of the order-level fees
  const feeShares = payment.method === 'cod' ? allocate(quote.totals.platformFeePaise + quote.totals.codFeePaise, quote.sellers.map((seller) => seller.payablePaise)) : null;

  let order;
  try {
    order = await withTransaction(async (s) => {
      const raced = await Order.findOne({ checkoutSessionId: session._id }).session(s);
      if (raced) return raced;
      const { committed } = await commitStock({ reference: stockReference(session) }, s);
      if (committed.length !== session.items.length) throw new Unfulfillable();
      const [created] = await Order.create([{
        number: orderNumber(),
        customerId: session.customerId,
        checkoutSessionId: session._id,
        paymentId: payment._id,
        paymentMethod: payment.method,
        address: session.address,
        couponCode: quote.couponCode,
        totals: quote.totals,
        subOrders: quote.sellers.map((seller, index) => ({
          sellerId: seller.sellerId,
          sellerName: seller.sellerName,
          items: quote.lines.filter((line) => line.sellerId === seller.sellerId).map(toItemDoc),
          itemsPaise: seller.itemsPaise,
          discountPaise: seller.discountPaise,
          shippingPaise: seller.shippingPaise,
          shippingDiscountPaise: seller.shippingDiscountPaise,
          payablePaise: seller.payablePaise,
          codDuePaise: feeShares ? seller.payablePaise + feeShares[index] : null,
          etaDays: seller.etaDays,
          shippingSource: seller.shippingSource,
          events: [{ status: SUB.CONFIRMED, at: new Date(), actorType: 'SYSTEM', actorId: null, note: null }],
        })),
        timeline: [{ status: ORDER_STATUS.CONFIRMED, at: new Date(), note: null }],
      }], { session: s });
      await recordOrderPlaced({ orderId: created._id, customerId: session.customerId, couponCode: quote.couponCode, discountPaise: quote.totals.couponDiscountPaise }, s);
      await CheckoutSession.updateOne({ _id: session._id }, { $set: { status: SESSION_STATUS.PLACED, orderId: created._id } }, { session: s });
      await Payment.updateOne({ _id: payment._id }, { $set: { orderId: created._id } }, { session: s });
      return created;
    });
  } catch (error) {
    if (error instanceof Unfulfillable) {
      await CheckoutSession.updateOne({ _id: session._id }, { $set: { status: SESSION_STATUS.EXPIRED } });
      if (payment.method !== 'cod') await refundPayment(payment._id, { reason: 'Items sold out before payment completed' }).catch((err) => logger.error({ err, paymentId: String(payment._id) }, 'Refund after unfulfillable order failed'));
      notifyUnfulfillable({ customerId: session.customerId, sessionId: session._id, amountPaise: payment.method === 'cod' ? 0 : payment.amountPaise });
      throw failure(409, 'ORDER_UNFULFILLABLE', payment.method === 'cod' ? 'Some items sold out before the order could be placed. Nothing was charged.' : 'Some items sold out before the payment completed. The payment will be refunded.');
    }
    if (error?.code === 11000) return Order.findOne({ checkoutSessionId: session._id });
    throw error;
  }

  if (session.source === 'CART') {
    await removeOrderedItems(session.customerId, session.items.map((item) => item.offerId))
      .catch((err) => logger.warn({ err }, 'Could not clear the ordered items from the cart')); // the order stands; the cart just keeps them
  }
  orderChanged(order);
  notifyOrderPlaced(order); // safe to repeat: each message is keyed by its event
  return order;
}

/* ------------------------------------------------------------------------------------------------- reads */

const STEPS = [
  [ORDER_STATUS.CONFIRMED, 'Order confirmed'],
  ['PROCESSING', 'Being prepared'],
  ['READY_TO_SHIP', 'Ready to ship'],
  ['SHIPPED', 'Shipped'],
  ['OUT_FOR_DELIVERY', 'Out for delivery'],
  ['DELIVERED', 'Delivered'],
];
// Statuses the steps do not list sit at the step they belong to: in transit is part of being shipped, a failed attempt part of out for delivery.
const STEP_OF = { IN_TRANSIT: 'SHIPPED', DELIVERY_FAILED: 'OUT_FOR_DELIVERY' };
const stepIndex = (status) => STEPS.findIndex(([step]) => step === (STEP_OF[status] ?? status));

function timelineOf(order) {
  const at = (status) => order.timeline.find((event) => event.status === status)?.at ?? null;
  if (order.status === ORDER_STATUS.CANCELLED) {
    return [[ORDER_STATUS.CONFIRMED, 'Order confirmed'], [ORDER_STATUS.CANCELLED, 'Order cancelled']]
      .map(([status, label], index) => ({ id: `${order._id}-${status}`, status, label, occurredAt: at(status)?.toISOString() ?? null, completed: true, active: index === 1 }));
  }
  // a step is done once the order has reached it or any later one, even if a status was skipped on the way
  const reached = Math.max(stepIndex(order.status), 0);
  return STEPS.map(([status, label], index) => {
    const event = index <= reached ? order.timeline.findLast((entry) => stepIndex(entry.status) === index) : null;
    return { id: `${order._id}-${status}`, status, label, occurredAt: event?.at?.toISOString() ?? null, completed: index <= reached, active: index === reached };
  });
}

const cancellable = (order) => {
  try {
    return allLiveParcels(order).length > 0;
  } catch {
    return false;
  }
};

/** `taken`: Map(itemId -> { id, status }) of the order's items that already have a return, which cannot be returned again. */
export const toOrderDto = (order, shipments = new Map(), taken = new Map()) => ({
  id: String(order._id),
  orderNumber: order.number,
  placedAt: order.placedAt.toISOString(),
  status: order.status,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentMethod === 'cod' ? (isCodCollected(order) ? 'PAID' : 'COD_PENDING') : order.refundedPaise >= order.totals.payablePaise ? 'REFUNDED' : 'PAID',
  deliveryCode: null,
  address: order.address,
  amountPaise: order.totals.payablePaise,
  items: order.subOrders.flatMap((sub) => sub.items.map((item) => {
    const shipment = shipments.get(String(sub._id));
    return {
      id: String(item._id),
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      mrpPaise: item.mrpPaise,
      sellerName: sub.sellerName,
      status: sub.status,
      shipmentId: shipment ? String(shipment._id) : null,
      awb: shipment?.awb ?? null,
      courierName: shipment?.courierName ?? null,
      canCancel: sub.status !== SUB.CANCELLED && cancellable(order),
      canReturn: returnState(sub, item, taken.has(String(item._id))).eligible,
      returnId: taken.get(String(item._id))?.id ?? null,
      returnStatus: taken.get(String(item._id))?.status ?? null,
    };
  })),
  totals: order.totals,
  canCancel: cancellable(order),
  canReturn: order.subOrders.some((sub) => sub.items.some((item) => returnState(sub, item, taken.has(String(item._id))).eligible)),
  timeline: timelineOf(order),
});

const shipmentsOf = (orders) => getShipmentsBySubOrder(orders.flatMap((order) => order.subOrders.map((sub) => sub._id)));

async function load(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId: String(customerId) });
  if (!order) throw new NotFoundError('This order does not exist.');
  return order;
}

export async function listOrders(customerId, { limit = 20, cursor } = {}) {
  const filter = { customerId: String(customerId) };
  const [rows, total] = await Promise.all([
    Order.find(cursor ? { ...filter, _id: { $lt: cursor } } : filter).sort({ _id: -1 }).limit(limit + 1),
    Order.countDocuments(filter),
  ]);
  const page = rows.slice(0, limit);
  const [shipments, taken] = await Promise.all([shipmentsOf(page), itemsWithReturn(page.map((order) => order._id))]);
  return { items: page.map((order) => toOrderDto(order, shipments, taken)), total, nextCursor: rows.length > limit ? String(page.at(-1)._id) : null };
}

export async function getOrder(customerId, orderId) {
  const order = await load(customerId, orderId);
  return toOrderDto(order, await shipmentsOf([order]), await itemsWithReturn([order._id]));
}
export const getOrderTimeline = async (customerId, orderId) => ({ items: timelineOf(await load(customerId, orderId)) });

/** Where a parcel is, for the customer who ordered it: the courier, the tracking number and every update so far. */
export async function getShipmentTracking(customerId, shipmentId) {
  const shipment = await getShipment(shipmentId);
  const order = shipment && await Order.findOne({ _id: shipment.orderId, customerId: String(customerId) });
  if (!order) throw new NotFoundError('This shipment does not exist.');
  const sub = order.subOrders.id(shipment.subOrderId);
  return {
    id: String(shipment._id),
    orderId: String(order._id),
    status: shipment.status,
    awb: shipment.awb,
    courierName: shipment.courierName,
    estimatedDeliveryDays: sub?.etaDays ?? null,
    events: shipment.events.filter((event) => event.status).map((event) => ({ status: event.status, description: event.providerStatus, location: event.location, occurredAt: event.at.toISOString() })),
  };
}

/** The customer's own paid checkout becomes their order (the app calls this right after paying). */
export async function createOrder(customerId, { checkoutSessionId, paymentId }) {
  const payment = await Payment.findOne({ _id: paymentId, customerId: String(customerId), checkoutSessionId });
  if (!payment) throw new NotFoundError('This payment does not exist.');
  return toOrderDto(await placeOrder({ sessionId: checkoutSessionId, customerId }));
}

/* ------------------------------------------------------------------------------------------------- cancel */

/**
 * The customer cancels their order before any seller has made a parcel ready to ship: stock goes back on sale and the
 * payment is refunded (see cancelParcels). Cancelling twice is a no-op. Parts a seller already cancelled stay cancelled and
 * were already refunded.
 */
export async function cancelOrder(customerId, orderId, { reason, comment } = {}) {
  const order = await load(customerId, orderId);
  const note = [reason, comment].filter(Boolean).join(': ') || null;
  const cancelled = await cancelParcels(order._id, { pick: allLiveParcels, actor: actorOf('CUSTOMER', customerId), note });
  return toOrderDto(cancelled, await shipmentsOf([cancelled]), await itemsWithReturn([cancelled._id]));
}

/* ---------------------------------------------------------------------------------------- Razorpay events */

let registered = false;

export function registerOrderWebhooks() {
  if (registered) return;
  registered = true;
  registerWebhookHandler('RAZORPAY', 'payment.captured', 'order.paymentCaptured', async (receipt) => {
    const { payment } = paymentGateway.parseWebhook(receipt.payload);
    const ours = payment && await recordCapture(payment); // null: another payment kind (banner ads, ...)
    if (!ours) return;
    try {
      await placeOrder({ sessionId: ours.checkoutSessionId });
    } catch (error) {
      if (error.code !== 'ORDER_UNFULFILLABLE') throw error; // already refunded; retrying would change nothing
    }
  });
  registerWebhookHandler('RAZORPAY', 'payment.failed', 'order.paymentFailed', async (receipt) => {
    const entity = receipt.payload?.payload?.payment?.entity;
    if (entity?.order_id) await recordFailure({ providerOrderId: entity.order_id, reason: entity.error_description });
  });
  // Courier progress from Shiprocket: the parcel's own record first, then the seller's part of the order follows it.
  registerWebhookHandler(SHIPROCKET, TRACKING_EVENT, 'order.shipmentTracking', async (receipt) => {
    const { awb, current_status: providerStatus, current_timestamp: stamp } = receipt.payload;
    // Shiprocket writes times like "23 05 2023 11:43:45" (day month year)
    const parsed = stamp ? Date.parse(String(stamp).replace(/^(\d{2}) (\d{2}) (\d{4}) /, '$3-$2-$1T')) : NaN;
    if (await recordReturnTracking({ awb: String(awb), providerStatus, at: Number.isFinite(parsed) ? new Date(parsed) : new Date() })) return; // a return's pickup, not a forward parcel
    const moved = await recordTracking({ awb: String(awb), providerStatus, at: Number.isFinite(parsed) ? new Date(parsed) : new Date() });
    if (!moved) return;
    // judged against the parcel itself: an admin may have moved it past where the courier now says it is
    const order = await Order.findById(moved.shipment.orderId, 'subOrders._id subOrders.status');
    const current = order?.subOrders.id(moved.shipment.subOrderId)?.status;
    if (current && canAdvance(current, moved.status)) {
      const move = moved.status === SUB.RTO_DELIVERED ? receiveRto : moveSubOrder; // back with the seller also refunds and restocks
      await move({ orderId: moved.shipment.orderId, subOrderId: moved.shipment.subOrderId, to: moved.status, from: [current], actor: actorOf('COURIER') });
    }
  });
  for (const event of ['refund.processed', 'refund.failed']) {
    registerWebhookHandler('RAZORPAY', event, 'order.refundUpdated', async (receipt) => {
      const { refund } = paymentGateway.parseWebhook(receipt.payload);
      if (refund) {
        await recordRefund(refund);
        await syncReturnRefund(refund);
      }
    });
  }
}
