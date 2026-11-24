import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getCustomerContact } from '../../identity/public/index.js';
import { getPaymentById } from '../../payment/public/index.js';
import { getShipmentsBySubOrder } from '../../shipping/public/index.js';
import { isCodCollected, SUB } from '../domain/services/orderStatus.js';
import { returnState } from '../domain/services/returnRules.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { toAdminReturnRow } from './adminReturn.service.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { listOrderInvoices } from './invoice.service.js';
import { actorOf, cancelParcels, moveSubOrder, receiveRto } from './orderTransitions.js';

// The admin console's read-only view of orders, in the shape its Orders pages read. Admin actions (hold, change address, cancel
// items, notes, returns) are not here yet. `id` is the order number: that is what admins see and search for.

const HOUR = 3_600_000;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { placedAt: 'placedAt', slaDueAt: 'placedAt', grandTotalPaise: 'totals.payablePaise', status: 'status', customerName: 'address.name' };

function slaOf(order, sla, now) {
  const placed = order.placedAt.getTime();
  const subs = order.subOrders.map((sub) => sub.status);
  const [label, hours] = subs.includes(SUB.CONFIRMED) ? ['Accept', sla.sellerAcceptSlaHours] : subs.includes(SUB.ACCEPTED) ? ['Dispatch', sla.dispatchSlaHoursSellerFulfilled] : [null, 0];
  const dueAt = label ? new Date(placed + hours * HOUR) : null;
  return { slaLabel: label, slaDueAt: dueAt?.toISOString() ?? null, slaBreached: Boolean(dueAt && dueAt.getTime() < now) };
}

const paymentStatusOf = (order) => (order.paymentMethod === 'cod' ? (isCodCollected(order) ? 'CAPTURED' : 'PENDING') : order.refundedPaise >= order.totals.payablePaise ? 'REFUNDED' : order.refundedPaise > 0 ? 'PARTIALLY_REFUNDED' : 'CAPTURED');

function toRow(order, shipments, sla, now = Date.now(), hasReturn = false) {
  const first = order.subOrders[0]?.items[0];
  const couriers = order.subOrders.map((sub) => shipments.get(String(sub._id))?.courierName).filter(Boolean);
  return {
    id: order.number,
    placedAt: order.placedAt.toISOString(),
    status: order.status,
    customerId: order.customerId,
    customerName: order.address.name,
    customerPhone: order.address.phone,
    paymentMethod: order.paymentMethod,
    paymentStatus: paymentStatusOf(order),
    channel: 'APP',
    couponCode: order.couponCode,
    grandTotalPaise: order.totals.payablePaise,
    itemCount: order.subOrders.reduce((sum, sub) => sum + sub.items.length, 0),
    sellerNames: [...new Set(order.subOrders.map((sub) => sub.sellerName))],
    firstItemName: first?.name ?? null,
    firstItemImage: first?.imageUrl ?? null,
    courierNames: [...new Set(couriers)],
    promisedDate: null,
    fulfillmentType: 'SELLER',
    hasReturn,
    onHold: false,
    riskScore: 0,
    address: { name: order.address.name, label: order.address.label, line: order.address.line, cityLine: `${order.address.city}, ${order.address.state} ${order.address.pincode}`, phone: order.address.phone, city: order.address.city, state: order.address.state, pincode: order.address.pincode },
    ...slaOf(order, sla, now),
  };
}

function listFilter({ q, status, paymentMethod, sellerId, state, city, pincode, couponCode, slaBreached, 'placedAt[gte]': from, 'placedAt[lte]': to }, sla, now) {
  const search = q ? new RegExp(escapeRegex(q), 'i') : null;
  const and = [];
  if (search) and.push({ $or: [{ number: search }, { 'address.name': search }, { 'address.phone': search }, { 'subOrders.items.name': search }] });
  if (slaBreached === 'true') {
    and.push({ $or: [
      { status: 'CONFIRMED', placedAt: { $lt: new Date(now - sla.sellerAcceptSlaHours * HOUR) } },
      { status: 'PROCESSING', placedAt: { $lt: new Date(now - sla.dispatchSlaHoursSellerFulfilled * HOUR) } },
    ] });
  }
  return {
    ...(status?.length ? { status: { $in: status } } : {}),
    ...(paymentMethod?.length ? { paymentMethod: { $in: paymentMethod } } : {}),
    ...(sellerId ? { 'subOrders.sellerId': sellerId } : {}),
    ...(state ? { 'address.state': new RegExp(`^${escapeRegex(state)}$`, 'i') } : {}),
    ...(city ? { 'address.city': new RegExp(`^${escapeRegex(city)}$`, 'i') } : {}),
    ...(pincode ? { 'address.pincode': pincode } : {}),
    ...(couponCode ? { couponCode: couponCode.toUpperCase() } : {}),
    ...(from || to ? { placedAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
    ...(and.length ? { $and: and } : {}),
  };
}

const csv = (value) => (value ? String(value).split(',').filter(Boolean) : []);

/** Orders, newest first by default, with per-status counts for the tabs (over everything the filters match except the tab). */
/** `sellerIds`: the sellers an admin is limited to (their role scope), or null for all. An order shows if any of its parcels is theirs. */
export async function listAdminOrders(query, { sellerIds = null } = {}) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 25)));
  const sort = query.sort || '-placedAt';
  const field = SORTS[sort.replace(/^-/, '')] ?? 'placedAt';
  const direction = sort.startsWith('-') || !SORTS[sort] ? -1 : 1;
  const now = Date.now();
  const sla = await getSettingsSection('orders');
  const input = { ...query, status: csv(query.status), paymentMethod: csv(query.paymentMethod) };
  const scoped = (filter) => (sellerIds ? { $and: [filter, { 'subOrders.sellerId': { $in: sellerIds } }] } : filter);
  const filter = scoped(listFilter(input, sla, now));

  const [rows, total, facetRows] = await Promise.all([
    Order.find(filter).sort({ [field]: direction, _id: direction }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: scoped(listFilter({ ...input, status: [] }, sla, now)) }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const shipments = await getShipmentsBySubOrder(rows.flatMap((order) => order.subOrders.map((sub) => sub._id)));
  const withReturn = new Set((await Return.find({ orderId: { $in: rows.map((order) => order._id) } }, 'orderId').lean()).map((row) => String(row.orderId)));
  return {
    data: rows.map((order) => toRow(order, shipments, sla, now, withReturn.has(String(order._id)))),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { status: Object.fromEntries(facetRows.map((row) => [row._id, row.n])) } },
  };
}

const PAYMENT_STATUS = { SUCCEEDED: 'CAPTURED', REQUIRES_ACTION: 'CREATED', FAILED: 'FAILED', CANCELLED: 'FAILED' };
const REFUND_STATUS = { SUCCEEDED: 'COMPLETED', PENDING: 'PROCESSING', FAILED: 'FAILED' };

/** One order with everything the detail page shows. `reference` is the order number (or its id). */
export async function getAdminOrder(reference, { canOverrideStatus = false } = {}) {
  const order = await Order.findOne(/^[a-f\d]{24}$/i.test(reference) ? { _id: reference } : { number: reference }).lean();
  if (!order) throw new NotFoundError('That order no longer exists.');
  const now = Date.now();
  const [sla, payment, contact, shipments, history, orderReturns] = await Promise.all([
    getSettingsSection('orders'),
    getPaymentById(order.paymentId),
    getCustomerContact(order.customerId),
    getShipmentsBySubOrder(order.subOrders.map((sub) => sub._id)),
    Order.aggregate([{ $match: { customerId: order.customerId, status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, orders: { $sum: 1 }, gmv: { $sum: '$totals.payablePaise' } } }]),
    Return.find({ orderId: order._id }),
  ]);
  const activeReturn = new Map(orderReturns.filter((row) => row.active).map((row) => [String(row.itemId), row]));

  const items = [];
  const parcels = order.subOrders.map((sub) => {
    const shipment = shipments.get(String(sub._id));
    const rows = sub.items.map((item) => ({
      id: String(item._id), productId: item.productId, name: item.name, image: item.imageUrl, variantLabel: item.variantLabel, qty: item.quantity,
      pricePaise: item.unitPricePaise, linePaise: item.amountPaise - item.discountPaise, status: sub.status, sellerId: sub.sellerId, sellerName: sub.sellerName,
      cancellable: false, returnId: activeReturn.has(String(item._id)) ? String(activeReturn.get(String(item._id))._id) : null,
      returnEligibility: (({ eligible, reason }) => ({ eligible, reason }))(returnState(sub, item, activeReturn.has(String(item._id)))),
      ...(sub.status === SUB.CANCELLED ? { cancelledBy: sub.events.at(-1)?.actorType ?? null, cancelReason: sub.events.at(-1)?.note ?? null } : {}),
    }));
    items.push(...rows);
    return { id: String(sub._id), sellerId: sub.sellerId, sellerName: sub.sellerName, status: sub.status, fulfillmentType: 'SELLER', awb: shipment?.awb ?? null, courierName: shipment?.courierName ?? null, lastScanLocation: shipment?.events.at(-1)?.location ?? null, promisedDate: null, items: rows };
  });

  const events = order.subOrders.flatMap((sub) => sub.events.map((event, index) => ({ id: `${sub._id}-${index}`, at: event.at.toISOString(), status: event.status, actorType: event.actorType, actorName: event.actorType === 'SELLER' ? sub.sellerName : event.actorType, note: event.note })))
    .sort((a, b) => b.at.localeCompare(a.at));

  const row = toRow(order, shipments, sla, now);
  return {
    data: {
      ...row,
      priceDetails: {
        itemTotalPaise: order.totals.subtotalPaise,
        deliveryFeePaise: order.totals.deliveryFeePaise,
        platformFeePaise: order.totals.platformFeePaise,
        discountPaise: order.totals.couponDiscountPaise,
        grandTotalPaise: order.totals.payablePaise,
      },
    },
    meta: {
      allowedActions: canOverrideStatus ? ['OVERRIDE_STATUS'] : [],
      items,
      shipments: parcels,
      payments: payment ? [{ id: String(payment._id), gateway: payment.provider, method: payment.method, amountPaise: payment.amountPaise, status: PAYMENT_STATUS[payment.status] ?? 'CREATED', txnRef: payment.providerPaymentId ?? payment.providerOrderId }] : [],
      refunds: (payment?.refunds ?? []).map((refund) => ({ id: refund.providerRefundId ?? refund.key, type: refund.key.startsWith('return:') ? 'RETURN' : 'CANCELLATION', amountPaise: refund.amountPaise, mode: 'ORIGINAL_METHOD', status: REFUND_STATUS[refund.status] ?? 'PROCESSING', initiatedAt: order.updatedAt.toISOString() })),
      returns: orderReturns.map((row) => toAdminReturnRow(row)),
      invoices: await listOrderInvoices(order._id),
      events,
      notes: [],
      customer: { id: order.customerId, name: contact?.name ?? order.address.name, phone: order.address.phone, email: contact?.email ?? null, status: 'ACTIVE', ordersCount: history[0]?.orders ?? 0, gmvPaise: history[0]?.gmv ?? 0, rtoPct: 0, returnPct: 0, riskScore: 0, walletBalancePaise: 0 },
    },
  };
}

export const PARCEL_STATUSES = Object.values(SUB);

/**
 * An admin sets one parcel's status by hand: forward or back, with a reason that is recorded in the audit log and in the
 * parcel's history. Setting CANCELLED is the real cancellation (stock returns, the parcel's amount is refunded, the customer
 * and seller are told); a cancelled parcel cannot be re-opened, because its stock and refund have already moved. Any other
 * status just moves the parcel and the order follows. No courier shipment is created or changed, and a later courier
 * update never undoes this by moving the parcel backwards. Returns the refreshed order for the admin page.
 */
export async function setParcelStatus(reference, parcelId, { status, reason }, auth) {
  const order = await Order.findOne(/^[a-f\d]{24}$/i.test(reference) ? { _id: reference } : { number: reference });
  const sub = order?.subOrders.id(parcelId);
  if (!sub) throw new NotFoundError('That order or shipment no longer exists.');
  if (sub.status === SUB.CANCELLED || sub.status === SUB.RTO_DELIVERED) throw new AppError({ code: 'PARCEL_CANCELLED', status: 409, message: 'This shipment was cancelled or returned to the seller, and its stock and refund have already been handled, so it cannot be re-opened.' });
  if (sub.status !== status) {
    const actor = actorOf('ADMIN', auth.userId);
    if (status === SUB.CANCELLED) {
      await cancelParcels(order._id, { pick: (fresh) => [fresh.subOrders.id(parcelId)], actor, note: reason });
    } else if (status === SUB.RTO_DELIVERED) {
      if (!await receiveRto({ orderId: order._id, subOrderId: sub._id, actor, note: reason })) throw new AppError({ code: 'ILLEGAL_TRANSITION', status: 409, message: 'Only a parcel that has been handed to a courier and not delivered can be marked as returned to the seller.' });
    } else {
      await moveSubOrder({ orderId: order._id, subOrderId: sub._id, to: status, actor, note: reason });
    }
    await recordAudit({ action: 'order.parcel.status.override', subjectType: 'order', subjectId: order._id, before: { parcelId, status: sub.status }, after: { parcelId, status }, reason, actor: { userId: auth.userId, role: auth.role } });
  }
  return getAdminOrder(String(order._id), { canOverrideStatus: true });
}
