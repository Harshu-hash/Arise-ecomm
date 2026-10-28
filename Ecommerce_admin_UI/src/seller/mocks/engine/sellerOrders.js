import { db, filter, findById, id, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { CANCELLABLE, canTransition, createRefund, recordEvent, refreshOrder } from '@mocks/engine/orderState';
import { maskPhone } from '@core/utils/mask';

/**
 * Seller-side order fulfilment over the shared order model. A seller works a
 * "shipment" — their slice of a customer order (one shipment per seller) — and
 * advances it through the shared item state machine:
 *   PLACED → ACCEPTED (confirm) → PACKED (invoice) → MANIFESTED (label) → SHIPPED (dispatch)
 * Every change writes the same `orderItems` / `shipments` / `orderEvents` the
 * admin Orders and Logistics screens read.
 */

const DISPATCH_SLA_HOURS = 24;

/** The next fulfilment step a shipment is waiting on (SELLER-fulfilled only). */
export function nextActionFor(status, fulfillmentType) {
  if (fulfillmentType === 'ARISE') return null; // Arise picks, packs and ships FBA orders.
  return { PLACED: 'confirm', ACCEPTED: 'pack', PACKED: 'manifest', MANIFESTED: 'dispatch' }[status] ?? null;
}

/** Coarse bucket for the seller's order tabs. */
export function stageFor(status) {
  if (status === 'PLACED' || status === 'ON_HOLD') return 'NEW';
  if (['ACCEPTED', 'PACKED', 'MANIFESTED'].includes(status)) return 'PROCESSING';
  if (['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'UNDELIVERED'].includes(status)) return 'SHIPPED';
  if (status === 'DELIVERED') return 'DELIVERED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status?.startsWith('RTO')) return 'RTO';
  return 'OTHER';
}

function activeItems(shipmentId) {
  return filter('orderItems', (i) => i.shipmentId === shipmentId && !['CANCELLED', 'PAYMENT_FAILED'].includes(i.status));
}

/** One seller order row: a shipment joined with its items and order context. */
export function shipmentRow(shipment, { revealContact = false } = {}) {
  const order = findById('orders', shipment.orderId);
  const items = filter('orderItems', (i) => i.shipmentId === shipment.id);
  const active = items.filter((i) => !['CANCELLED', 'PAYMENT_FAILED'].includes(i.status));
  const totalPaise = active.reduce((n, i) => n + i.linePaise, 0);
  const dispatchByAt = order ? new Date(new Date(order.placedAt).getTime() + DISPATCH_SLA_HOURS * 3600_000).toISOString() : null;
  const preShip = ['PLACED', 'ON_HOLD', 'ACCEPTED', 'PACKED', 'MANIFESTED'].includes(shipment.status);
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    placedAt: order?.placedAt ?? null,
    customerName: order?.customerName ?? '—',
    customerPhone: revealContact ? order?.address?.phone : maskPhone(order?.address?.phone ?? ''),
    city: order?.address?.city ?? null,
    state: order?.address?.state ?? null,
    paymentMethod: order?.paymentMethod ?? null,
    prepaid: order?.paymentMethod !== 'COD',
    status: shipment.status,
    stage: stageFor(shipment.status),
    fulfillmentType: shipment.fulfillmentType,
    nextAction: nextActionFor(shipment.status, shipment.fulfillmentType),
    courierName: shipment.courierName ?? null,
    awb: shipment.awb ?? null,
    invoiceNo: shipment.invoiceNo ?? null,
    itemCount: active.length,
    totalPaise,
    dispatchByAt,
    slaBreached: preShip && dispatchByAt ? new Date(dispatchByAt).getTime() < mockNow() : false,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      variantLabel: i.variantLabel,
      image: i.image,
      qty: i.qty,
      pricePaise: i.pricePaise,
      linePaise: i.linePaise,
      status: i.status,
    })),
  };
}

export function sellerOrders(sellerId, opts) {
  return filter('shipments', (s) => s.sellerId === sellerId).map((s) => shipmentRow(s, opts));
}

/** Pick an active courier for a new manifest (COD-capable when needed). */
function pickCourier(order) {
  const needsCod = order?.paymentMethod === 'COD';
  const eligible = db.couriers
    .filter((c) => c.status === 'ACTIVE' && c.type !== 'REVERSE' && (!needsCod || c.codEnabled))
    .sort((a, b) => (a.allocationPriority ?? 99) - (b.allocationPriority ?? 99));
  return eligible[0] ?? db.couriers.find((c) => c.status === 'ACTIVE') ?? null;
}

const FLOW = {
  confirm: { to: 'ACCEPTED', event: 'ACCEPTED' },
  pack: { to: 'PACKED', event: 'PACKED' },
  manifest: { to: 'MANIFESTED', event: 'MANIFESTED' },
  dispatch: { to: 'SHIPPED', event: 'SHIPPED' },
};

/**
 * Advance a shipment one fulfilment step. Returns { error } on an illegal move
 * or { shipment } on success. Mutates items, the shipment and the order.
 */
export function advanceShipment(shipment, action, actorName) {
  if (shipment.fulfillmentType === 'ARISE') return { error: 'Arise fulfils this order; you do not need to process it.' };
  const step = FLOW[action];
  if (!step) return { error: 'Unknown action.' };

  const items = activeItems(shipment.id);
  if (!items.length) return { error: 'There is nothing left to process on this order.' };
  if (!canTransition(items[0].status, step.to)) {
    return { error: `This order is ${shipment.status} and cannot be ${action}ed now.` };
  }

  const order = findById('orders', shipment.orderId);
  const patch = { status: step.to };
  if (action === 'pack') patch.invoiceNo = shipment.invoiceNo ?? `INV-${shipment.id}`;
  if (action === 'manifest') {
    const courier = pickCourier(order);
    patch.courierId = courier?.id ?? null;
    patch.courierName = courier?.name ?? 'Arise Express';
    patch.awb = shipment.awb ?? `AWB${String(mockNow()).slice(-10)}`;
    patch.manifestedAt = mockNowIso();
  }
  if (action === 'dispatch') {
    patch.lastScanAt = mockNowIso();
    patch.lastScanLocation = `${order?.address?.city ?? 'Origin'} Hub`;
  }

  for (const item of items) {
    update('orderItems', item.id, { status: step.to });
    recordEvent({ orderId: order.id, itemId: item.id, status: step.event, actorType: 'SELLER', actorName, note: null });
  }
  update('shipments', shipment.id, patch);
  refreshOrder(order.id);
  return { shipment: findById('shipments', shipment.id) };
}

/** Seller-initiated cancellation of a whole shipment (pre-dispatch only). */
export function cancelShipment(shipment, reason, actor) {
  const items = activeItems(shipment.id);
  if (!items.length) return { error: 'Nothing to cancel on this order.' };
  if (!CANCELLABLE.includes(items[0].status)) {
    return { error: 'This order can no longer be cancelled — it has already shipped.' };
  }
  const order = findById('orders', shipment.orderId);
  for (const item of items) {
    update('orderItems', item.id, { status: 'CANCELLED', cancelledBy: 'SELLER', cancelReason: reason ?? 'Cancelled by seller' });
    recordEvent({ orderId: order.id, itemId: item.id, status: 'CANCELLED', actorType: 'SELLER', actorName: actor?.name, note: reason });
  }
  update('shipments', shipment.id, { status: 'CANCELLED' });

  // A prepaid cancellation owes the customer a refund.
  let refund = null;
  if (order.paymentMethod !== 'COD') {
    const amount = items.reduce((n, i) => n + i.linePaise, 0);
    refund = createRefund({ order, items, type: 'CANCELLATION', amountPaise: amount, actor, reason });
  }
  refreshOrder(order.id);
  return { shipment: findById('shipments', shipment.id), refund };
}

export function orderTimeline(shipmentId) {
  const items = filter('orderItems', (i) => i.shipmentId === shipmentId);
  const itemIds = new Set(items.map((i) => i.id));
  return filter('orderEvents', (e) => itemIds.has(e.itemId)).sort((a, b) => new Date(a.at) - new Date(b.at));
}

export { id };
