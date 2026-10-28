import { db, filter, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { createRefund } from '@mocks/engine/orderState';

/**
 * Seller-side returns, inventory and FBA inbound over the shared collections
 * the admin Warehouses/Logistics screens read. A seller handles its own
 * self-ship returns and sends stock to Arise warehouses; Arise-fulfilled
 * returns and receiving are done by the admin side.
 */

/* ----------------------------------------------------------------- returns */

const RETURN_OPEN = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT_TO_ORIGIN', 'RECEIVED'];

export function returnStage(status) {
  if (status === 'RETURN_REQUESTED') return 'REQUESTED';
  if (RETURN_OPEN.includes(status)) return 'IN_PROGRESS';
  if (['QC_PASSED', 'QC_FAILED', 'CLOSED'].includes(status)) return 'COMPLETED';
  return 'REJECTED';
}

export function sellerReturnActions(r) {
  const fba = r.fulfillmentType === 'ARISE';
  if (fba) return []; // Arise processes FBA returns.
  const out = [];
  if (r.status === 'RETURN_REQUESTED') out.push('approve', 'reject');
  if (['PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT_TO_ORIGIN'].includes(r.status)) out.push('receive');
  if (r.status === 'RECEIVED') out.push('qc');
  return out;
}

export function returnRow(r) {
  const item = findById('orderItems', r.orderItemId);
  return {
    ...r,
    fulfillmentType: item?.fulfillmentType ?? 'SELLER',
    stage: returnStage(r.status),
    actions: sellerReturnActions({ ...r, fulfillmentType: item?.fulfillmentType ?? 'SELLER' }),
    ageHours: Math.floor((mockNow() - new Date(r.requestedAt).getTime()) / 3600_000),
  };
}

export function sellerReturns(sellerId) {
  return filter('returns', (r) => r.sellerId === sellerId).map(returnRow);
}

function reverseCourier() {
  return db.couriers.find((c) => c.status === 'ACTIVE' && (c.type === 'REVERSE' || c.type === 'BOTH')) ?? db.couriers[0] ?? null;
}

/** Apply a seller return decision; returns { error } or { return }. */
export function decideReturn(r, action, body, actor) {
  const item = findById('orderItems', r.orderItemId);
  if ((item?.fulfillmentType ?? 'SELLER') === 'ARISE') return { error: 'Arise processes returns for Fulfilled-by-Arise orders.' };
  const allowed = sellerReturnActions({ ...r, fulfillmentType: 'SELLER' });
  if (!allowed.includes(action)) return { error: `This return cannot be ${action}ed in its current state.` };

  const order = findById('orders', r.orderId);
  let patch = {};
  let refund = null;

  if (action === 'approve') {
    const courier = reverseCourier();
    patch = { status: 'PICKUP_SCHEDULED', approvedAt: mockNowIso(), approvedByName: actor?.name, pickupAwb: `AWB${String(mockNow()).slice(-10)}`, reverseCourierName: courier?.name ?? 'Arise Reverse' };
  } else if (action === 'reject') {
    if (!String(body?.reason ?? '').trim()) return { error: 'A reason is required to reject a return.' };
    patch = { status: 'RETURN_REJECTED', decisionReason: body.reason, decidedByName: actor?.name };
  } else if (action === 'receive') {
    patch = { status: 'RECEIVED', receivedAt: mockNowIso() };
  } else if (action === 'qc') {
    const passed = body?.result === 'PASS';
    patch = { status: passed ? 'QC_PASSED' : 'QC_FAILED', qcResult: body?.result ?? 'FAIL', qcNotes: body?.notes ?? null, qcAt: mockNowIso(), qcByName: actor?.name };
    if (passed && order) {
      refund = createRefund({ order, items: [item].filter(Boolean), type: 'RETURN', amountPaise: r.amountPaise, actor, reason: r.reason });
      patch.refundId = refund.id;
      patch.status = 'CLOSED';
    }
  }
  update('returns', r.id, patch);
  return { return: returnRow(findById('returns', r.id)), refund };
}

/* --------------------------------------------------------------- inventory */

export function inventoryRow(inv) {
  const available = inv.sellable - inv.reserved;
  const daysOfCover = inv.dailyVelocity ? Math.floor(available / inv.dailyVelocity) : null;
  return {
    ...inv,
    available,
    daysOfCover,
    lowStock: available < (inv.lowStockThreshold ?? 20),
    aged: inv.oldestUnitDays > 180,
  };
}

export function sellerInventory(sellerId) {
  return filter('inventory', (i) => i.sellerId === sellerId).map(inventoryRow);
}

/* ----------------------------------------------------------------- inbound */

export function inboundRow(c) {
  const lines = filter('inboundLines', (l) => l.consignmentId === c.id);
  return {
    ...c,
    lineCount: lines.length,
    declaredUnits: lines.reduce((n, l) => n + (l.declaredQty ?? 0), 0),
    receivedUnits: lines.reduce((n, l) => n + (l.receivedSellable ?? 0), 0),
    discrepancyUnits: lines.reduce((n, l) => n + (l.receivedMissing ?? 0) + (l.receivedDamaged ?? 0), 0),
  };
}

export function sellerInbound(sellerId) {
  return filter('inboundConsignments', (c) => c.sellerId === sellerId).map(inboundRow);
}

export function createInbound(seller, body) {
  const warehouse = findById('warehouses', body?.warehouseId);
  if (!warehouse) return { error: 'Pick a warehouse.' };
  const lines = Array.isArray(body?.lines) ? body.lines.filter((l) => l.variantId && Number(l.qty) > 0) : [];
  if (!lines.length) return { error: 'Add at least one SKU with a quantity.' };

  const consignment = insert('inboundConsignments', {
    id: id('INB', 5),
    sellerId: seller.id,
    sellerName: seller.storeName,
    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    status: 'DRAFT',
    createdAt: mockNowIso(),
    appointmentAt: null,
    appointmentSlot: null,
    vehicleNo: null,
    invoiceNo: body?.invoiceNo ?? null,
    ewayBillNo: body?.ewayBillNo ?? null,
    boxCount: Number(body?.boxCount) || lines.length,
    receivedAt: null,
    receivedByName: null,
    hasDiscrepancy: false,
    createdBySeller: true,
    version: 1,
  });
  for (const l of lines) {
    const variant = findById('variants', l.variantId);
    const product = variant ? findById('products', variant.productId) : null;
    insert('inboundLines', {
      id: id('IBL', 6),
      consignmentId: consignment.id,
      variantId: l.variantId,
      sku: variant?.sku ?? l.sku ?? '—',
      productTitle: product?.title ?? l.productTitle ?? '—',
      variantLabel: variant?.label ?? null,
      declaredQty: Number(l.qty),
      receivedSellable: 0,
      receivedDamaged: 0,
      receivedMissing: 0,
      note: null,
      version: 1,
    });
  }
  return { consignment: inboundRow(consignment) };
}

export function transitionInbound(c, action) {
  if (action === 'submit') {
    if (c.status !== 'DRAFT') return { error: 'Only a draft can be submitted.' };
    update('inboundConsignments', c.id, { status: 'SUBMITTED', submittedAt: mockNowIso() });
  } else if (action === 'cancel') {
    if (['RECEIVED', 'CLOSED'].includes(c.status)) return { error: 'A received consignment cannot be cancelled.' };
    update('inboundConsignments', c.id, { status: 'CANCELLED' });
  } else {
    return { error: 'Unknown action.' };
  }
  return { consignment: inboundRow(findById('inboundConsignments', c.id)) };
}

/* --------------------------------------------------------------- removals */

export function createRemoval(inv, body) {
  const qty = Math.max(1, Math.min(Number(body?.qty) || 0, inv.sellable));
  if (!qty) return { error: 'Enter a quantity to remove.' };
  const type = body?.type === 'DISPOSE' ? 'DISPOSE' : 'RETURN_TO_SELLER';
  const removal = insert('removalOrders', {
    id: id('RMV', 5),
    inventoryId: inv.id,
    variantId: inv.variantId,
    sku: inv.sku,
    productTitle: inv.productTitle,
    sellerId: inv.sellerId,
    sellerName: inv.sellerName,
    warehouseId: inv.warehouseId,
    warehouseCode: inv.warehouseCode,
    type,
    qty,
    feePaise: qty * 1500,
    status: 'REQUESTED',
    reason: body?.reason ?? (inv.oldestUnitDays > 180 ? 'Aged stock' : 'Seller request'),
    awb: null,
    requestedAt: mockNowIso(),
    version: 1,
  });
  return { removal };
}

export { createRefund };
