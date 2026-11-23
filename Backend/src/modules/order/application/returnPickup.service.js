import { logger } from '../../../config/logger.js';
import { shippingGateway } from '../../../infrastructure/external/shipping/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { getCustomerContact, getSellerPickupProfile } from '../../identity/public/index.js';
import { getVariantShippingSpecs } from '../../product/public/index.js';
import { packageOf } from '../../shipping/public/index.js';
import { PICKUP_DAYS, qcDeadline, RETURN_STATUS as S } from '../domain/services/returnRules.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { notifyOpsPickupCancelFailed, notifyReturnMoved } from './orderNotifications.js';

// The courier's trip for an approved return: Shiprocket collects the item from the customer and brings it to the seller.

const LOCK_MS = 90_000;
const failure = (status, code, message, retryable = false) => new AppError({ code, message, status, retryable });
const orderOf = (ret) => Order.findById(ret.orderId, 'number customerId subOrders');

/** What the courier needs of one side of the trip, or the list of what is missing. */
const missing = (party) => Object.entries({ address: party.address, city: party.city, state: party.state, pincode: party.pincode, phone: party.phone }).filter(([, value]) => !value).map(([key]) => key);

/**
 * Books the courier for an approved return: creates the reverse shipment on Shiprocket, gets its tracking number and asks for
 * the pickup. Every step is saved as it succeeds, so after a failure (low Shiprocket balance, a courier hiccup) calling it
 * again carries on; calling it twice at once or after it worked changes nothing. Returns the return.
 */
export async function schedulePickup(returnId) {
  const now = new Date();
  const ret = await Return.findOneAndUpdate(
    { _id: returnId, status: S.APPROVED, $or: [{ 'reverse.lockedUntil': null }, { 'reverse.lockedUntil': { $lt: now } }] },
    { $set: { 'reverse.lockedUntil': new Date(now.getTime() + LOCK_MS) } },
    { new: true },
  );
  if (!ret) {
    const current = await Return.findById(returnId);
    if (current && current.status !== S.APPROVED) return current; // already booked, or not at the stage for it
    throw failure(409, 'PICKUP_IN_PROGRESS', 'This pickup is already being arranged. Try again in a moment.', true);
  }
  try {
    const order = await orderOf(ret);
    const item = order.subOrders.id(ret.subOrderId).items.id(ret.itemId);
    if (!ret.reverse.providerShipmentId) {
      const seller = await getSellerPickupProfile(ret.sellerId);
      const drop = { name: seller?.contactName, ...seller?.location, phone: seller?.phone, email: seller?.email };
      const email = (await getCustomerContact(order.customerId))?.email ?? seller?.email ?? 'no-reply@arise.local';
      const pickup = { ...ret.pickupAddress, address: ret.pickupAddress.line, email };
      const gaps = [...missing(pickup).map((key) => `customer ${key}`), ...missing(drop).map((key) => `seller ${key}`)];
      if (gaps.length) throw failure(409, 'PICKUP_ADDRESS_INCOMPLETE', `The pickup cannot be booked: missing ${gaps.join(', ')}.`);
      const specs = await getVariantShippingSpecs([item.variantId]);
      const { weightG, dimsCm } = packageOf([item], specs);
      const created = await shippingGateway.createReturnShipment({
        reference: ret.number,
        placedAt: ret.createdAt,
        pickup,
        drop,
        items: [{ name: item.name, sku: specs.get(String(item.variantId))?.sku ?? String(item.variantId), units: item.quantity, pricePaise: Math.round((item.amountPaise - item.discountPaise) / item.quantity) }],
        weightG,
        dimsCm,
      });
      ret.reverse.shiprocketOrderId = created.shiprocketOrderId;
      ret.reverse.providerShipmentId = created.shipmentId;
      await ret.save();
    }
    if (!ret.reverse.awb) {
      const { awb, courierName } = await shippingGateway.assignAwb(ret.reverse.providerShipmentId, { isReturn: true });
      ret.reverse.awb = awb;
      ret.reverse.courierName = courierName;
      await ret.save();
    }
    if (!ret.reverse.pickupRequestedAt) {
      // it already has its tracking number; a failed pickup request is retried by the courier's own schedule
      await shippingGateway.requestPickup(ret.reverse.providerShipmentId)
        .then(() => { ret.reverse.pickupRequestedAt = new Date(); })
        .catch((err) => logger.warn({ err, returnId: String(ret._id) }, 'Return pickup request failed; the return still has its tracking number'));
      await ret.save();
    }
    const moved = await Return.findOneAndUpdate(
      { _id: ret._id, status: S.APPROVED },
      { $set: { status: S.PICKUP_SCHEDULED, 'reverse.pickupDueAt': new Date(Date.now() + PICKUP_DAYS * 86_400_000) }, $push: { events: { status: S.PICKUP_SCHEDULED, at: new Date(), actorType: 'SYSTEM', actorId: null, note: null } } },
      { new: true },
    );
    if (moved) notifyReturnMoved(order, moved);
    else {
      // withdrawn (or lapsed) while it was being booked: the booking just made has to be undone too
      const current = await Return.findById(ret._id);
      if (current.status === S.CANCELLED) await cancelPickup(current);
    }
    return moved ?? Return.findById(ret._id);
  } finally {
    await Return.updateOne({ _id: ret._id }, { $set: { 'reverse.lockedUntil': null } });
  }
}

// Shiprocket's words for a reverse shipment's progress -> ours. Anything else is recorded and moves nothing.
const courierStatus = (providerStatus) => {
  const text = String(providerStatus ?? '').trim().toUpperCase();
  if (text.includes('PICKED UP')) return S.PICKED_UP;
  if (text === 'DELIVERED') return S.RECEIVED; // delivered to the seller
  return null;
};
const MOVES_FROM = { [S.PICKED_UP]: [S.APPROVED, S.PICKUP_SCHEDULED], [S.RECEIVED]: [S.APPROVED, S.PICKUP_SCHEDULED, S.PICKED_UP] };

/**
 * A courier update for `awb`. Returns false when the number is not a return's (so the caller treats it as a forward parcel);
 * true once it has been handled. Every update is kept in the return's history; only the ones that matter move it, and never backwards.
 */
export async function recordReturnTracking({ awb, providerStatus, at = new Date() }) {
  const ret = await Return.findOne({ 'reverse.awb': awb }, '_id orderId');
  if (!ret) return false;
  const to = courierStatus(providerStatus);
  await Return.updateOne({ _id: ret._id }, { $push: { 'reverse.events': { status: to, providerStatus, at } } });
  if (to) {
    const moved = await Return.findOneAndUpdate(
      { _id: ret._id, status: { $in: MOVES_FROM[to] } },
      { $set: { status: to, ...(to === S.RECEIVED ? { qcDueAt: qcDeadline() } : {}) }, $push: { events: { status: to, at: new Date(), actorType: 'COURIER', actorId: null, note: null } } },
      { new: true },
    );
    const order = moved && await orderOf(moved);
    if (order) notifyReturnMoved(order, moved);
  }
  return true;
}

/**
 * A return was withdrawn or lapsed: the courier booking, if there is one, is cancelled on Shiprocket so nobody turns up. Never
 * throws: the return is already cancelled. A booking that could not be cancelled is recorded on the return for ops.
 */
export async function cancelPickup(ret) {
  if (!ret.reverse?.awb || ret.reverse.cancelledAt) return;
  try {
    await shippingGateway.cancelShipment(ret.reverse.awb);
    await Return.updateOne({ _id: ret._id }, { $set: { 'reverse.cancelledAt': new Date(), 'reverse.cancelError': null } });
  } catch (err) {
    logger.error({ err, returnId: String(ret._id), awb: ret.reverse.awb }, 'Could not cancel the courier pickup of a cancelled return; it may still be collected');
    const message = String(err.message).slice(0, 300);
    await Return.updateOne({ _id: ret._id }, { $set: { 'reverse.cancelError': message } });
    if (!ret.reverse.opsAlertedAt && await notifyOpsPickupCancelFailed(ret, message)) await Return.updateOne({ _id: ret._id }, { $set: { 'reverse.opsAlertedAt': new Date() } });
  }
}

/** Ops (or an admin) retry cancelling a cancelled return's courier booking. Unlike cancelPickup this tells the caller why it still fails. */
export async function retryCancelPickup(returnId) {
  const ret = await Return.findById(returnId);
  if (!ret) throw failure(404, 'RETURN_NOT_FOUND', 'That return no longer exists.');
  if (ret.status !== S.CANCELLED) throw failure(409, 'RETURN_NOT_CANCELLED', 'Only a cancelled return has a pickup to cancel.');
  if (!ret.reverse.awb || ret.reverse.cancelledAt) return ret; // nothing to cancel, or already done
  await shippingGateway.cancelShipment(ret.reverse.awb);
  return Return.findByIdAndUpdate(returnId, { $set: { 'reverse.cancelledAt': new Date(), 'reverse.cancelError': null } }, { new: true });
}
