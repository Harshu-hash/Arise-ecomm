import { db, filter, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { createRefund } from '@mocks/engine/orderState';
import { appendReturnEvent, createReplacementFulfilment, returnProjection } from '@mocks/engine/returnWorkflow';

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
    ...returnProjection(r),
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
    appendReturnEvent(r, { type: 'RETURN_APPROVED', actorType: 'SELLER', actorName: actor?.name, reason: body?.reason, evidenceMediaIds: body?.evidenceMediaIds });
  } else if (action === 'reject') {
    if (!String(body?.reason ?? '').trim()) return { error: 'A reason is required to reject a return.' };
    patch = { status: 'RETURN_REJECTED', decisionReasonCode: body.reasonCode ?? 'OTHER', decisionReason: body.reason, decisionEvidenceMediaIds: body.evidenceMediaIds ?? [], decidedAt: mockNowIso(), decidedByName: actor?.name };
    appendReturnEvent(r, { type: 'RETURN_REJECTED', actorType: 'SELLER', actorName: actor?.name, reason: body.reason, evidenceMediaIds: body.evidenceMediaIds ?? [], metadata: { reasonCode: body.reasonCode ?? 'OTHER' } });
  } else if (action === 'receive') {
    patch = { status: 'RECEIVED', receivedAt: mockNowIso() };
    appendReturnEvent(r, { type: 'RECEIVED', actorType: 'SELLER', actorName: actor?.name });
  } else if (action === 'qc') {
    const passed = body?.result === 'PASS';
    if (!passed && (!String(body?.reasonCode ?? '').trim() || !String(body?.notes ?? '').trim() || !(body?.evidenceMediaIds?.length))) return { error: 'Failed QC requires a reason code, notes and evidence.' };
    patch = { status: passed ? 'QC_PASSED' : 'QC_FAILED', qcResult: body?.result ?? 'FAIL', qcReasonCode: body?.reasonCode ?? null, qcNotes: body?.notes ?? null, qcEvidenceMediaIds: body?.evidenceMediaIds ?? [], qcAt: mockNowIso(), qcByName: actor?.name };
    appendReturnEvent(r, { type: passed ? 'QC_PASSED' : 'QC_FAILED', actorType: 'SELLER', actorName: actor?.name, reason: body?.notes, evidenceMediaIds: body?.evidenceMediaIds ?? [], metadata: { reasonCode: body?.reasonCode ?? null } });
    if (passed && order) {
      if (r.type === 'REPLACEMENT') {
        update('returns', r.id, patch);
        const replacement = createReplacementFulfilment(findById('returns', r.id), { name: actor?.name, type: 'SELLER' });
        return { return: returnRow(findById('returns', r.id)), replacement };
      }
      refund = createRefund({ order, items: [item].filter(Boolean), type: 'RETURN', amountPaise: r.amountPaise, actor, reason: r.reason });
      patch.refundId = refund.id;
      patch.status = 'CLOSED';
      appendReturnEvent(r, { type: 'REFUND_CREATED', actorType: 'SYSTEM', actorName: 'Refund service', metadata: { refundId: refund.id } });
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
    fulfillmentType: inv.fulfillmentType ?? 'ARISE',
    blocked: inv.blocked ?? 0,
    quarantined: inv.quarantined ?? 0,
    damaged: inv.damaged ?? 0,
  };
}

export function sellerInventory(sellerId) {
  ensureSelfShipInventory(sellerId);
  return filter('inventory', (i) => i.sellerId === sellerId).map(inventoryRow);
}

export function ensureSelfShipInventory(sellerId) {
  const primary = filter('pickupAddresses', (row) => row.sellerId === sellerId && row.status !== 'INACTIVE').find((row) => row.isPrimary)
    ?? filter('pickupAddresses', (row) => row.sellerId === sellerId && row.status !== 'INACTIVE')[0];
  if (!primary) return [];
  const created = [];
  for (const offer of filter('offers', (row) => row.sellerId === sellerId && row.fulfillmentType !== 'ARISE' && row.status !== 'DELETED')) {
    const existing = db.inventory.find((row) => row.offerId === offer.id && row.fulfillmentType === 'SELLER');
    if (existing) continue;
    const variant = findById('variants', offer.variantId);
    const product = variant ? findById('products', variant.productId) : null;
    created.push(insert('inventory', {
      id: id('INV', 7), offerId: offer.id, variantId: offer.variantId,
      sku: variant?.sku ?? offer.id, productTitle: product?.title ?? 'Seller listing', variantLabel: variant?.label ?? null,
      sellerId, sellerName: offer.sellerName, warehouseId: primary.id, warehouseCode: primary.label,
      fulfillmentType: 'SELLER', sellable: Number(offer.stock) || 0, reserved: 0, damaged: 0, blocked: 0, quarantined: 0,
      dailyVelocity: 1, lowStockThreshold: 10, oldestUnitDays: 0, version: 1,
    }));
  }
  return created;
}

export function writeSellerLedger(inventory, type, qty, reference, note) {
  return insert('inventoryLedger', {
    id: id('ILG', 8), inventoryId: inventory.id, variantId: inventory.variantId,
    warehouseId: inventory.warehouseId, type, qty, balanceAfter: inventory.sellable,
    reference: reference ?? null, note: note ?? null, at: mockNowIso(),
  });
}

export function changeSellerStock(inventory, body) {
  const requested = Number(body?.sellable);
  if (!Number.isInteger(requested) || requested < 0) return { error: 'Stock must be a whole number of zero or more.', code: 'STOCK_INVALID' };
  if (requested < inventory.reserved) return { error: `Stock cannot be below ${inventory.reserved} reserved units.`, code: 'RESERVED_STOCK' };
  if (body?.version != null && Number(body.version) !== inventory.version) return { error: 'This stock row changed. Refresh and retry.', code: 'VERSION_CONFLICT', current: inventoryRow(inventory) };
  const before = inventory.sellable;
  update('inventory', inventory.id, { sellable: requested });
  const current = findById('inventory', inventory.id);
  if (current.offerId) {
    const offer = findById('offers', current.offerId);
    if (offer) update('offers', offer.id, { stock: requested, status: requested > current.reserved ? (offer.status === 'OUT_OF_STOCK' ? 'LIVE' : offer.status) : 'OUT_OF_STOCK' });
  }
  writeSellerLedger(current, 'ADJUSTMENT', requested - before, body?.reference, body?.note ?? 'Seller stock update');
  return { inventory: inventoryRow(current) };
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
    packagingType: body?.packagingType === 'PALLET' ? 'PALLET' : 'CARTON',
    cartons: Array.isArray(body?.cartons) ? body.cartons : [],
    palletCount: Number(body?.palletCount) || 0,
    requestedAppointmentAt: body?.requestedAppointmentAt ?? null,
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
