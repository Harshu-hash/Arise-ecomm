import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getCustomerContact, getSellerOwnerEmail } from '../../identity/public/index.js';
import { env } from '../../../config/env.js';
import { getShipmentsBySubOrder, mockReadyToShip, readyToShip } from '../../shipping/public/index.js';
import { nextActionOf, SELLER_ACTIONS, STAGES, stageOf, SUB } from '../domain/services/orderStatus.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { ensureInvoices, invoiceNumbersBySubOrder, issueInvoices, sellerDocumentsOf } from './invoice.service.js';
import { actorOf, cancelParcels, moveSubOrder, oneParcel } from './orderTransitions.js';

// What a seller sees and does. A "shipment" in the seller panel is one sub-order: the seller's own part of a customer's
// order. Everything is scoped by the seller id from the signed-in account, never from the request.

const PRE_SHIP = [SUB.CONFIRMED, SUB.ACCEPTED];
const HOUR = 3_600_000;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const failure = (status, code, message, details = null) => new AppError({ code, message, status, details });

const maskPhone = (phone = '') => (phone.length > 4 ? `${'•'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone);

/** One row of the seller's order list (and the top of the detail view). */
function toRow(order, sub, shipment, { slaHours, reveal = false, now = Date.now(), invoiceNo = null }) {
  const dispatchByAt = new Date(order.placedAt.getTime() + slaHours * HOUR);
  return {
    id: String(sub._id),
    orderId: order.number,
    placedAt: order.placedAt.toISOString(),
    customerName: order.address.name,
    customerPhone: reveal ? order.address.phone : maskPhone(order.address.phone),
    city: order.address.city,
    state: order.address.state,
    paymentMethod: order.paymentMethod,
    prepaid: true,
    status: sub.status,
    stage: stageOf(sub.status),
    fulfillmentType: 'SELLER',
    nextAction: nextActionOf(sub.status),
    courierName: shipment?.courierName ?? null,
    awb: shipment?.awb ?? null,
    invoiceNo,
    packages: [],
    scans: [],
    itemCount: sub.items.length,
    totalPaise: sub.itemsPaise - sub.discountPaise,
    dispatchByAt: dispatchByAt.toISOString(),
    slaBreached: PRE_SHIP.includes(sub.status) && dispatchByAt.getTime() < now,
    items: sub.items.map((item) => ({
      id: String(item._id),
      name: item.name,
      variantLabel: item.variantLabel,
      image: item.imageUrl,
      qty: item.quantity,
      pricePaise: item.unitPricePaise,
      linePaise: item.amountPaise - item.discountPaise,
      status: sub.status,
    })),
  };
}

/** Finds the seller's parcel, or 404: other sellers' parcels are never revealed. */
async function ownParcel(sellerId, subOrderId) {
  const order = await Order.findOne({ subOrders: { $elemMatch: { _id: subOrderId, sellerId: String(sellerId) } } });
  const sub = order?.subOrders.id(subOrderId);
  if (!sub) throw new NotFoundError('That order is not on your account.');
  return { order, sub };
}

async function rowFor(sellerId, subOrderId, options) {
  const { order, sub } = await ownParcel(sellerId, subOrderId);
  const shipment = (await getShipmentsBySubOrder([sub._id])).get(String(sub._id));
  const invoiceNo = (await invoiceNumbersBySubOrder([sub._id])).get(String(sub._id));
  return toRow(order, sub, shipment, { slaHours: (await getSettingsSection('orders')).dispatchSlaHoursSellerFulfilled, invoiceNo, ...options });
}

/* ------------------------------------------------------------------------------------------------------ list */

function listFilter(sellerId, { stage, status = [], q }) {
  const statuses = status.length ? status : stage && STAGES[stage] ? STAGES[stage] : null;
  const search = q ? new RegExp(escapeRegex(q), 'i') : null;
  return {
    'subOrders.sellerId': String(sellerId),
    ...(statuses ? { 'subOrders.status': { $in: statuses } } : {}),
    ...(search ? { $or: [{ number: search }, { 'address.name': search }] } : {}),
  };
}

const SORTS = { placedAt: 'placedAt', dispatchByAt: 'placedAt', totalPaise: 'subOrders.payablePaise' };

/** The seller's parcels, a page at a time, with the counts the order tabs show. */
export async function listSellerOrders(sellerId, query) {
  const { page, pageSize, sort = '-placedAt' } = query;
  const { dispatchSlaHoursSellerFulfilled: slaHours } = await getSettingsSection('orders');
  const own = [{ $match: { 'subOrders.sellerId': String(sellerId) } }, { $unwind: '$subOrders' }, { $match: { 'subOrders.sellerId': String(sellerId) } }];
  const field = SORTS[sort.replace(/^-/, '')] ?? 'placedAt';
  const direction = sort.startsWith('-') || !SORTS[sort] ? -1 : 1;
  const breachCutoff = new Date(Date.now() - slaHours * HOUR);

  const [rows, [total], statusCounts, [breaching]] = await Promise.all([
    Order.aggregate([...own, { $match: listFilter(sellerId, query) }, { $sort: { [field]: direction, _id: direction } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }]),
    Order.aggregate([...own, { $match: listFilter(sellerId, query) }, { $count: 'n' }]),
    Order.aggregate([...own, { $group: { _id: '$subOrders.status', n: { $sum: 1 } } }]),
    Order.aggregate([...own, { $match: { 'subOrders.status': { $in: PRE_SHIP }, placedAt: { $lt: breachCutoff } } }, { $count: 'n' }]),
  ]);

  const parcelIds = rows.map((row) => row.subOrders._id);
  const [shipments, invoiceNos] = await Promise.all([getShipmentsBySubOrder(parcelIds), invoiceNumbersBySubOrder(parcelIds)]);
  const byStatus = new Map(statusCounts.map((entry) => [entry._id, entry.n]));
  const count = (stage) => STAGES[stage].reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0);
  const totalRows = total?.n ?? 0;
  return {
    data: rows.map((row) => toRow(row, row.subOrders, shipments.get(String(row.subOrders._id)), { slaHours, invoiceNo: invoiceNos.get(String(row.subOrders._id)) })), // after $unwind, subOrders is the one parcel
    meta: {
      page,
      pageSize,
      total: totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      counts: { ...Object.fromEntries(Object.keys(STAGES).map((stage) => [stage, count(stage)])), breaching: breaching?.n ?? 0 },
    },
  };
}

/* ---------------------------------------------------------------------------------------------------- detail */

export async function getSellerOrder(sellerId, subOrderId) {
  const { order, sub } = await ownParcel(sellerId, subOrderId);
  await ensureInvoices(order); // a parcel already past ready-to-ship always shows its invoice
  const shipment = (await getShipmentsBySubOrder([sub._id])).get(String(sub._id));
  const { dispatchSlaHoursSellerFulfilled: slaHours } = await getSettingsSection('orders');
  const invoiceNo = (await invoiceNumbersBySubOrder([sub._id])).get(String(sub._id));
  return {
    ...toRow(order, sub, shipment, { slaHours, reveal: true, invoiceNo }),
    address: order.address,
    priceDetails: {
      itemsPaise: sub.itemsPaise,
      discountPaise: sub.discountPaise,
      shippingPaise: sub.shippingPaise - sub.shippingDiscountPaise,
      grandTotalPaise: sub.payablePaise,
      commissionPaise: sub.items.reduce((sum, item) => sum + item.commissionPaise, 0),
    },
    timeline: sub.events.map((event, index) => ({ id: `${sub._id}-${index}`, status: event.status, at: event.at.toISOString(), actorType: event.actorType, actorName: event.actorType, note: event.note })),
    documents: [
      ...(shipment?.labelUrl ? [{ id: `${shipment._id}-label`, type: 'SHIPPING_LABEL', version: 1, createdAt: shipment.updatedAt.toISOString(), downloadUrl: shipment.labelUrl }] : []),
      ...(await sellerDocumentsOf(sellerId, sub._id, (id) => `/finance/invoices/${id}/pdf`)),
    ],
    manifest: null,
    exceptions: [],
    courierOptions: [],
  };
}

/* --------------------------------------------------------------------------------------------------- actions */

const notNow = (action, status) => failure(409, 'ILLEGAL_TRANSITION', `This order is ${status} and cannot be ${action === 'confirm' ? 'accepted' : 'made ready to ship'} now.`);

/** The seller accepts the order. Accepting twice is harmless. */
export async function confirmSubOrder(sellerId, subOrderId, auth) {
  const { order, sub } = await ownParcel(sellerId, subOrderId);
  if (sub.status !== SUB.ACCEPTED) {
    const moved = await moveSubOrder({ orderId: order._id, subOrderId: sub._id, to: SUB.ACCEPTED, from: SELLER_ACTIONS.confirm, actor: actorOf('SELLER', auth.userId) });
    if (!moved) throw notNow('confirm', sub.status);
  }
  return rowFor(sellerId, subOrderId, { reveal: true });
}

/**
 * "Ready to ship": the parcel is created on Shiprocket with its label and tracking number and the courier is asked to
 * collect it, then the order moves to READY_TO_SHIP. Safe to click again after a Shiprocket failure (it resumes) or after
 * it worked (it does nothing).
 */
export async function readyToShipSubOrder(sellerId, subOrderId, auth) {
  const { order, sub } = await ownParcel(sellerId, subOrderId);
  if (sub.status !== SUB.READY_TO_SHIP) {
    if (!SELLER_ACTIONS['ready-to-ship'].includes(sub.status)) throw notNow('ready-to-ship', sub.status);
    // Shiprocket insists on an email: the customer's, or the seller's when the customer has none on file.
    const billingEmail = (await getCustomerContact(order.customerId))?.email ?? await getSellerOwnerEmail(sellerId);
    await readyToShip({
      orderId: order._id,
      subOrderId: sub._id,
      sellerId: String(sellerId),
      reference: `${order.number}-${String(sub._id).slice(-4).toUpperCase()}`,
      placedAt: order.placedAt,
      collectPaise: sub.codDuePaise > 0 ? sub.codDuePaise : null,
      customer: { name: order.address.name, phone: order.address.phone, email: billingEmail ?? 'no-reply@arise.local', address: order.address.line, city: order.address.city, state: order.address.state, pincode: order.address.pincode },
      items: sub.items.map((item) => ({ name: `${item.name}${item.variantLabel && item.variantLabel !== 'Standard' ? ` - ${item.variantLabel}` : ''}`, variantId: item.variantId, quantity: item.quantity, pricePaise: item.unitPricePaise - Math.floor(item.discountPaise / item.quantity) })),
    });
    // The courier may already have reported progress while we were finishing; only move a parcel still waiting on the seller.
    await moveSubOrder({ orderId: order._id, subOrderId: sub._id, to: SUB.READY_TO_SHIP, from: SELLER_ACTIONS['ready-to-ship'], actor: actorOf('SELLER', auth.userId) });
  }
  await issueInvoices(order._id, sub._id); // outside the branch so clicking again heals a failed issue
  return rowFor(sellerId, subOrderId, { reveal: true });
}

/** TESTING ONLY, not available in production or staging: "ready to ship" without Shiprocket (see mockReadyToShip). */
export async function mockReadyToShipSubOrder(sellerId, subOrderId, auth) {
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') throw new NotFoundError('Not found.');
  const { order, sub } = await ownParcel(sellerId, subOrderId);
  if (sub.status !== SUB.READY_TO_SHIP) {
    if (!SELLER_ACTIONS['ready-to-ship'].includes(sub.status)) throw notNow('ready-to-ship', sub.status);
    await mockReadyToShip({ orderId: order._id, subOrderId: sub._id, sellerId: String(sellerId) });
    await moveSubOrder({ orderId: order._id, subOrderId: sub._id, to: SUB.READY_TO_SHIP, from: SELLER_ACTIONS['ready-to-ship'], actor: actorOf('SELLER', auth.userId) });
  }
  await issueInvoices(order._id, sub._id);
  return rowFor(sellerId, subOrderId, { reveal: true });
}

/** The seller cancels their part before it is ready to ship: stock returns, and the customer is refunded that part. */
export async function cancelSubOrder(sellerId, subOrderId, reason, auth) {
  const { order } = await ownParcel(sellerId, subOrderId);
  await cancelParcels(order._id, { pick: oneParcel(sellerId, subOrderId), actor: actorOf('SELLER', auth.userId), note: reason ?? 'Cancelled by seller' });
  return rowFor(sellerId, subOrderId, { reveal: true });
}

/** Runs confirm or ready-to-ship over many parcels; one failing never stops the rest. */
export async function bulkSellerAction(sellerId, action, ids, auth) {
  const run = { confirm: confirmSubOrder, 'ready-to-ship': readyToShipSubOrder }[action];
  const failures = [];
  let done = 0;
  for (const id of ids) {
    try {
      await run(sellerId, id, auth);
      done += 1;
    } catch (error) {
      failures.push({ id, reason: error.message });
    }
  }
  return { done, failed: failures.length, failures };
}

/** Ids of every parcel the seller's filters match (for "select all matching"), capped so one click stays bounded. */
export async function matchingParcelIds(sellerId, filters, limit = 200) {
  const rows = await Order.aggregate([
    { $match: { 'subOrders.sellerId': String(sellerId) } },
    { $unwind: '$subOrders' },
    { $match: listFilter(sellerId, { stage: filters.tab && filters.tab !== 'all' ? filters.tab : undefined, status: filters.status ? String(filters.status).split(',') : [], q: filters.q }) },
    { $project: { _id: 0, id: '$subOrders._id' } },
    { $limit: limit },
  ]);
  return rows.map((row) => String(row.id));
}
