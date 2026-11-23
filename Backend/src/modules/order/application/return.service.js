import { randomBytes } from 'node:crypto';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getAddress } from '../../customer/public/index.js';
import { returnChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { CUSTOMER_CANCELLABLE, MAX_EVIDENCE_FILES, journeyOf, RETURN_LABELS, RETURN_REASONS, RETURN_STATUS, returnState } from '../domain/services/returnRules.js';
import { assertReturnCoverable } from '../../settlement/public/index.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { notifyReturnRequested, notifyReturnWithdrawn } from './orderNotifications.js';
import { cancelPickup } from './returnPickup.service.js';
import { Return } from '../infrastructure/persistence/return.model.js';

// What the customer does with returns: see what can be returned, ask for it, look at it, withdraw it.
// Refund only (to the original payment); the seller's decision, the pickup, QC and the refund come next.

const DECISION_HOURS = 48; // how long the seller has to approve or reject
const DUPLICATE_KEY = 11000;
const failure = (status, code, message) => new AppError({ code, status, message });
const returnNumber = () => `RET${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
const PICKUP_LABEL = 'We schedule the pickup once the seller approves your request';

/** The items (among these orders) that already have a return open or done, as Map(itemId -> { id, status }): they cannot be returned again. */
export async function itemsWithReturn(orderIds) {
  return new Map((await Return.find({ orderId: { $in: orderIds }, active: true }, 'itemId status').lean()).map((row) => [String(row.itemId), { id: String(row._id), status: row.status }]));
}

async function loadOrder(customerId, orderId) {
  const order = await Order.findOne({ _id: orderId, customerId: String(customerId) });
  if (!order) throw new NotFoundError('This order does not exist.');
  return order;
}

/** Every item of the order with whether (and why not) it can be returned now. */
export async function getReturnableItems(customerId, orderId, now = new Date()) {
  const order = await loadOrder(customerId, orderId);
  const taken = await itemsWithReturn([order._id]);
  return {
    orderId: String(order._id),
    items: order.subOrders.flatMap((sub) => sub.items.map((item) => {
      const state = returnState(sub, item, taken.has(String(item._id)), now);
      return {
        orderItemId: String(item._id), productId: item.productId, name: item.name, imageUrl: item.imageUrl, quantity: item.quantity,
        eligible: state.eligible, ineligibleReason: state.reason, returnWindowEndsAt: state.windowEndsAt?.toISOString() ?? null,
        allowedResolutions: state.eligible ? ['REFUND'] : [],
      };
    })),
    reasons: RETURN_REASONS.map(({ code, label, requiresEvidence }) => ({ code, label, requiresEvidence })),
    pickupRequired: true,
    refundDestinations: ['ORIGINAL_PAYMENT'],
  };
}

/** The return as the app reads it. */
export const toReturnDto = (row) => ({
  id: String(row._id),
  orderId: String(row.orderId),
  orderItemId: String(row.itemId),
  resolution: row.resolution,
  reasonCode: row.reasonCode,
  status: row.status,
  pickupAddressId: row.pickupAddress.id,
  pickupWindowLabel: row.reverse?.awb ? `${row.reverse.courierName ?? 'The courier'} will collect it (tracking ${row.reverse.awb})` : PICKUP_LABEL,
  evidenceMediaIds: row.evidenceKeys,
  createdAt: row.createdAt.toISOString(),
  refund: { status: row.refund.status, amountPaise: row.amountPaise, destination: row.refund.destination },
  // for the status screen
  orderNumber: row.orderNumber,
  productName: row.productName,
  imageUrl: row.imageUrl,
  courier: row.reverse?.awb ? { name: row.reverse.courierName, awb: row.reverse.awb } : null,
  outcomeNote: row.status === RETURN_STATUS.REJECTED ? row.decision?.reason ?? null : row.status === RETURN_STATUS.QC_FAILED ? row.qc?.notes ?? null : null,
  canCancel: CUSTOMER_CANCELLABLE.includes(row.status),
  journey: journeyOf(row.events),
  timeline: row.events.map((event) => ({ status: event.status, label: RETURN_LABELS[event.status] ?? event.status, at: event.at.toISOString() })),
});

// An upload's id is its storage key: private/returns/<customer>/<file>. Evidence must be the customer's own return uploads.
const ownEvidence = (customerId, key) => {
  const [, folder, owner] = String(key).split('/');
  return folder === 'returns' && owner === String(customerId);
};

/** The customer asks to return one delivered item. Checked here, never trusted from the app: eligibility, reason, evidence, pickup address. */
export async function createReturn(customerId, { orderId, orderItemId, resolution, reasonCode, pickupAddressId, evidenceMediaIds = [], comment = null }, now = new Date(), { adminId = null } = {}) {
  const order = await loadOrder(customerId, orderId);
  const sub = order.subOrders.find((parcel) => parcel.items.id(orderItemId));
  const item = sub?.items.id(orderItemId);
  if (!item) throw new NotFoundError('This item is not part of the order.');
  const state = returnState(sub, item, Boolean(await Return.exists({ itemId: item._id, active: true })), now);
  if (!state.eligible) throw failure(409, 'ITEM_NOT_RETURNABLE', state.reason);
  if (resolution !== 'REFUND') throw failure(409, 'RESOLUTION_NOT_AVAILABLE', 'Choose an available resolution.');
  await assertReturnCoverable(item._id); // the seller's wallet must be able to give back money it already released
  const reason = RETURN_REASONS.find((entry) => entry.code === reasonCode);
  if (!reason) throw failure(422, 'RETURN_REASON_REQUIRED', 'Choose a return reason.');
  if (reason.requiresEvidence && !evidenceMediaIds.length && !adminId) throw failure(422, 'EVIDENCE_REQUIRED', 'Add a photo for this return reason.');
  if (evidenceMediaIds.length > MAX_EVIDENCE_FILES || !evidenceMediaIds.every((key) => ownEvidence(customerId, key))) throw failure(422, 'EVIDENCE_INVALID', 'One or more evidence uploads are invalid.');
  const pickupAddress = await getAddress(String(customerId), pickupAddressId);
  if (!pickupAddress) throw failure(404, 'PICKUP_ADDRESS_NOT_FOUND', 'Choose a valid pickup address.');

  const at = new Date();
  try {
    const created = await Return.create({
      number: returnNumber(), orderNumber: order.number, customerName: order.address.name, sellerName: sub.sellerName, productName: item.name, variantLabel: item.variantLabel, imageUrl: item.imageUrl, orderId: order._id, subOrderId: sub._id, itemId: item._id, customerId: String(customerId), sellerId: sub.sellerId,
      reasonCode, faultAttribution: reason.fault, comment, evidenceKeys: evidenceMediaIds, pickupAddress,
      amountPaise: item.amountPaise - item.discountPaise, decisionDueAt: new Date(at.getTime() + DECISION_HOURS * 3_600_000),
      events: [{ status: RETURN_STATUS.REQUESTED, at, actorType: adminId ? 'ADMIN' : 'CUSTOMER', actorId: String(adminId ?? customerId), note: comment }],
    });
    notifyReturnRequested(created);
    returnChanged(created);
    return toReturnDto(created);
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw failure(409, 'ITEM_NOT_RETURNABLE', 'A return request already exists for this item.'); // two taps at once
    throw error;
  }
}

async function loadReturn(customerId, returnId) {
  const row = await Return.findOne({ _id: returnId, customerId: String(customerId) });
  if (!row) throw failure(404, 'RETURN_NOT_FOUND', 'This return request was not found.');
  return row;
}

export async function getReturn(customerId, returnId) {
  return toReturnDto(await loadReturn(customerId, returnId));
}

/** The customer withdraws a request until the courier has collected the item; a booked pickup is cancelled and an approving seller is told. Withdrawing twice is harmless. */
export async function cancelReturn(customerId, returnId) {
  const row = await loadReturn(customerId, returnId);
  if (row.status === RETURN_STATUS.CANCELLED) return toReturnDto(row);
  const cancelled = await Return.findOneAndUpdate(
    { _id: row._id, status: { $in: CUSTOMER_CANCELLABLE } },
    { $set: { status: RETURN_STATUS.CANCELLED, active: false }, $push: { events: { status: RETURN_STATUS.CANCELLED, at: new Date(), actorType: 'CUSTOMER', actorId: String(customerId), note: null } } },
    { new: true },
  );
  if (!cancelled) throw failure(409, 'RETURN_NOT_CANCELLABLE', 'This return can no longer be cancelled.');
  await cancelPickup(cancelled);
  returnChanged(cancelled);
  if (row.status !== RETURN_STATUS.REQUESTED) notifyReturnWithdrawn(cancelled); // the seller had approved it and may be expecting the item
  return toReturnDto(await Return.findById(cancelled._id));
}

/** The customer's returns, newest first (cursor = the last return id of the page before). */
export async function listReturns(customerId, { limit = 20, cursor } = {}) {
  const filter = { customerId: String(customerId) };
  const [rows, total] = await Promise.all([
    Return.find(cursor ? { ...filter, _id: { $lt: cursor } } : filter).sort({ _id: -1 }).limit(limit + 1),
    Return.countDocuments(filter),
  ]);
  const page = rows.slice(0, limit);
  return { items: page.map(toReturnDto), total, nextCursor: rows.length > limit ? String(page.at(-1)._id) : null };
}
