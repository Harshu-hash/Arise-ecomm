import { withTransaction } from '../../../config/database.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { computeLine, OPEN_RETURN_STATUSES } from '../domain/settlementRules.js';
import { SettlementLine } from '../infrastructure/persistence/settlementLine.model.js';
import { SellerWallet } from '../infrastructure/persistence/wallet.model.js';
import { post } from './wallet.service.js';

// How money reaches a seller's wallet. A delivered item becomes one line, credited as pending; once its return window and the
// settlement buffer pass (and no return is open) a job releases it to available; a refund after that takes it back. Every step
// is keyed, so the order module's calls, the sweep and the release job can all repeat or race without paying anything twice.

const DAY = 86_400_000;
const DUPLICATE_KEY = 11000;
// a return that was refunded already cancelled this money: the sweep must not create a line for it
const REFUNDED = ['QC_PASSED', 'REFUND_INITIATED', 'REFUND_COMPLETED'];

const lineDoc = (order, sub, item, rates) => {
  const deliveredAt = sub.deliveredAt ?? new Date();
  const days = (item.returnWindowDays ?? 0) + rates.holdBufferDays;
  return {
    key: `${sub._id}:${item._id}`,
    orderId: order._id,
    orderNumber: order.number,
    subOrderId: sub._id,
    orderItemId: item._id,
    sellerId: sub.sellerId,
    sellerName: sub.sellerName,
    productTitle: `${item.name}${item.variantLabel && item.variantLabel !== 'Standard' ? ` - ${item.variantLabel}` : ''}`,
    qty: item.quantity,
    customerName: order.address?.name ?? '',
    paymentMethod: String(order.paymentMethod).toUpperCase(),
    deliveredAt,
    returnWindowDays: item.returnWindowDays ?? 0,
    releaseAt: new Date(deliveredAt.getTime() + days * DAY),
    codPending: order.paymentMethod === 'cod',
    commissionPct: item.commissionPct ?? 0,
    ...computeLine({ salePaise: item.amountPaise - item.discountPaise, gstPaise: item.gstPaise ?? 0, commissionPaise: item.commissionPaise ?? 0, rates }),
  };
};

/** Creates the line and credits the wallet's pending balance, in one transaction. False when the line already existed. */
async function accrueItem(doc) {
  try {
    return await withTransaction(async (session) => {
      if (await SettlementLine.exists({ key: doc.key }).session(session)) return false;
      const [line] = await SettlementLine.create([doc], { session });
      await post(session, { sellerId: doc.sellerId, event: `EARN:${line._id}`, type: 'EARNING', moves: [{ bucket: 'pending', deltaPaise: doc.netPaise }], refType: 'LINE', refId: line._id, orderNumber: doc.orderNumber, note: doc.productTitle, lifetime: { earned: doc.netPaise } });
      return true;
    });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) return false; // another call made it first
    throw error;
  }
}

/** The order module calls this when a parcel is delivered. A failure is logged and left for the sweep; it never throws into the delivery. */
export async function accrueDelivered(orderId, subOrderId) {
  try {
    const [order, rates] = await Promise.all([Order.findById(orderId), getSettingsSection('settlement')]);
    const sub = order?.subOrders.id(subOrderId);
    if (!sub) return 0;
    let made = 0;
    for (const item of sub.items) if (await accrueItem(lineDoc(order, sub, item, rates))) made += 1;
    return made;
  } catch (err) {
    logger.error({ err, orderId: String(orderId), subOrderId: String(subOrderId) }, 'Could not credit a delivered parcel to the seller wallet; the sweep will retry');
    return 0;
  }
}

/** Credits any parcel delivered in the last `sinceDays` days that has no lines yet (a missed call). Returns how many lines it made. */
export async function accrueMissing({ sinceDays = 30, limit = 500 } = {}) {
  const since = new Date(Date.now() - sinceDays * DAY);
  const orders = await Order.find({ subOrders: { $elemMatch: { status: 'DELIVERED', deliveredAt: { $gte: since } } } }).sort({ _id: -1 }).limit(limit);
  const parcels = orders.flatMap((order) => order.subOrders.filter((sub) => sub.status === 'DELIVERED' && sub.deliveredAt >= since).map((sub) => [order, sub]));
  if (!parcels.length) return 0;
  const [rates, have, refunded] = await Promise.all([
    getSettingsSection('settlement'),
    SettlementLine.distinct('key', { subOrderId: { $in: parcels.map(([, sub]) => sub._id) } }),
    Return.find({ orderId: { $in: orders.map((order) => order._id) }, status: { $in: REFUNDED } }, 'itemId').lean(),
  ]);
  const done = new Set(have);
  const skip = new Set(refunded.map((row) => String(row.itemId)));
  let made = 0;
  for (const [order, sub] of parcels) {
    for (const item of sub.items) {
      if (skip.has(String(item._id)) || done.has(`${sub._id}:${item._id}`)) continue;
      if (await accrueItem(lineDoc(order, sub, item, rates))) made += 1;
    }
  }
  return made;
}

/** Item ids among `itemIds` that have a return open (one that will cost the seller the item's money). */
export async function itemsWithOpenReturn(itemIds) {
  if (!itemIds.length) return new Set();
  const rows = await Return.find({ itemId: { $in: itemIds }, active: true, status: { $in: OPEN_RETURN_STATUSES } }, 'itemId').lean();
  return new Set(rows.map((row) => String(row.itemId)));
}

/**
 * Moves due lines from pending to available: return window and buffer over, no return open, and (for cash on delivery) the
 * courier's cash received. Each line is claimed with a conditional update, so a line is never released twice. Returns how many.
 */
export async function releaseDue({ now = new Date(), limit = 500 } = {}) {
  const due = await SettlementLine.find({ releasedAt: null, reversedAt: null, releaseAt: { $lte: now }, $or: [{ codPending: false }, { codRemittedAt: { $ne: null } }] }).sort({ releaseAt: 1 }).limit(limit).lean();
  const held = await itemsWithOpenReturn(due.map((line) => line.orderItemId));
  let released = 0;
  for (const line of due.filter((entry) => !held.has(String(entry.orderItemId)))) {
    const done = await withTransaction(async (session) => {
      const claimed = await SettlementLine.findOneAndUpdate({ _id: line._id, releasedAt: null, reversedAt: null }, { $set: { releasedAt: now } }, { session });
      if (!claimed) return false;
      await post(session, { sellerId: line.sellerId, event: `REL:${line._id}`, type: 'RELEASE', moves: [{ bucket: 'pending', deltaPaise: -line.netPaise }, { bucket: 'available', deltaPaise: line.netPaise }], refType: 'LINE', refId: line._id, orderNumber: line.orderNumber, note: line.productTitle });
      return true;
    }).catch((error) => {
      if (error?.code === DUPLICATE_KEY) return false;
      throw error;
    });
    if (done) released += 1;
  }
  return released;
}

/**
 * The item was returned and refunded: its money is taken back from the wallet (pending if it was not released yet, otherwise
 * available, which may then go negative if the seller already withdrew it). Safe to repeat.
 * shortcut: the whole net is taken back, fees included; refine if returns should keep a fee.
 */
export async function reverseForReturn(orderItemId, reason = 'Item returned and refunded') {
  await withTransaction(async (session) => {
    const line = await SettlementLine.findOneAndUpdate({ orderItemId, reversedAt: null }, { $set: { reversedAt: new Date(), reverseReason: reason } }, { new: true, session });
    if (!line) return;
    await post(session, { sellerId: line.sellerId, event: `REV:${line._id}`, type: 'RETURN_REVERSAL', moves: [{ bucket: line.releasedAt ? 'available' : 'pending', deltaPaise: -line.netPaise }], refType: 'LINE', refId: line._id, orderNumber: line.orderNumber, note: reason, lifetime: { earned: -line.netPaise } });
  }).catch((error) => {
    if (error?.code !== DUPLICATE_KEY) throw error;
  });
}

/**
 * A return may only be started for an item whose money the seller can give back. Money still pending is simply taken back; money
 * already released must be covered by the seller's available balance, or the return is refused (the customer is told to contact support).
 */
export async function assertReturnCoverable(orderItemId) {
  const line = await SettlementLine.findOne({ orderItemId, releasedAt: { $ne: null }, reversedAt: null }, 'sellerId netPaise').lean();
  if (!line || line.netPaise <= 0) return;
  const wallet = await SellerWallet.findById(line.sellerId, 'availablePaise').lean();
  if ((wallet?.availablePaise ?? 0) < line.netPaise) {
    throw new AppError({ code: 'RETURN_UNAVAILABLE', status: 409, message: 'This return cannot be started right now. Please contact support and we will sort it out.' });
  }
}

/** Admin: the courier's cash for these cash-on-delivery lines has reached Arise, so they may be released. Returns how many were marked. */
export async function markCodRemitted(lineIds) {
  const result = await SettlementLine.updateMany({ _id: { $in: lineIds }, codPending: true, codRemittedAt: null }, { $set: { codRemittedAt: new Date() } });
  return result.modifiedCount;
}
