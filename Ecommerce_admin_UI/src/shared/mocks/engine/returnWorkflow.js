import { db, filter, findById, id, insert, update } from '../db/store';
import { mockNow, mockNowIso } from './settings';

const POLICY = {
  'Item is damaged or defective': { eligible: true, explanation: 'Covered when damage or a manufacturing defect is shown in customer evidence.', faultAttribution: 'SELLER' },
  'Wrong item delivered': { eligible: true, explanation: 'Covered when the received SKU differs from the order line.', faultAttribution: 'SELLER' },
  'Item not as described': { eligible: true, explanation: 'Covered when the listing and received item materially differ.', faultAttribution: 'SELLER' },
  'Size/fit issue': { eligible: true, explanation: 'Covered within the category return window with original tags and packaging.', faultAttribution: 'CUSTOMER' },
  'Changed my mind': { eligible: true, explanation: 'Covered within the category return window if unused and complete.', faultAttribution: 'CUSTOMER' },
};

export function returnPolicy(row) {
  const item = findById('orderItems', row.orderItemId);
  const policy = POLICY[row.reason] ?? { eligible: true, explanation: 'Eligibility follows the category return window and item condition.', faultAttribution: 'UNKNOWN' };
  const decisionDueAt = row.decisionDueAt ?? new Date(new Date(row.requestedAt).getTime() + 48 * 3600_000).toISOString();
  return { ...policy, returnWindowDays: item?.returnWindowDays ?? null, returnWindowEndsAt: item?.returnWindowEndsAt ?? null, decisionDueAt, decisionOverdue: mockNow() > new Date(decisionDueAt).getTime() && row.status === 'RETURN_REQUESTED' };
}

export function visibleReturnEvidence(row) {
  const refs = row.customerEvidence?.length
    ? row.customerEvidence
    : (row.images ?? []).map((url, index) => ({ id: `${row.id}-customer-${index + 1}`, url, fileName: `Customer evidence ${index + 1}`, visibility: 'PUBLIC', moderationStatus: 'APPROVED' }));
  return refs.filter((ref) => ref.visibility !== 'INTERNAL' && ref.moderationStatus !== 'REJECTED').map((ref) => {
    const media = ref.mediaId ? findById('mediaResources', ref.mediaId) : null;
    return { ...ref, mediaId: ref.mediaId ?? media?.id ?? null, url: ref.url ?? media?.previewUrl ?? media?.downloadUrl ?? null, fileName: ref.fileName ?? media?.fileName ?? 'Evidence', mimeType: ref.mimeType ?? media?.mimeType ?? null };
  });
}

export function appendReturnEvent(returnRow, { type, actorType, actorName, reason, evidenceMediaIds = [], metadata = {} }) {
  return insert('returnEvents', { id: id('REV', 7), returnId: returnRow.id, orderId: returnRow.orderId, type, actorType, actorName, reason: reason ?? null, evidenceMediaIds, metadata, at: mockNowIso(), version: 1 });
}

export function returnTimeline(row) {
  const events = filter('returnEvents', (event) => event.returnId === row.id);
  const derived = [{ id: `${row.id}-requested`, returnId: row.id, type: 'RETURN_REQUESTED', actorType: 'CUSTOMER', actorName: row.customerName ?? 'Customer', reason: row.reason, at: row.requestedAt }];
  return [...derived, ...events].sort((a, b) => a.at.localeCompare(b.at));
}

export function createReplacementFulfilment(row, actor) {
  const existing = db.replacements.find((replacement) => replacement.returnId === row.id);
  if (existing) return existing;
  const source = findById('orderItems', row.orderItemId);
  const order = findById('orders', row.orderId);
  const item = insert('orderItems', {
    ...source,
    id: id('ITM', 7),
    status: 'CONFIRMED',
    deliveredAt: null,
    returnWindowEndsAt: null,
    replacementForReturnId: row.id,
    version: 1,
  });
  const shipment = insert('shipments', {
    id: id('SHP', 7), orderId: row.orderId, sellerId: row.sellerId, sellerName: row.sellerName,
    fulfillmentType: source?.fulfillmentType ?? 'SELLER', courierId: null, courierName: null, awb: null,
    status: 'CONFIRMED', promisedDate: new Date(mockNow() + 5 * 86400_000).toISOString(), lastScanAt: null,
    lastScanLocation: null, attempts: 0, replacementForReturnId: row.id, version: 1,
  });
  update('orderItems', item.id, { shipmentId: shipment.id });
  const replacement = insert('replacements', {
    id: id('RPL', 6), returnId: row.id, orderId: row.orderId, originalOrderItemId: row.orderItemId,
    replacementOrderItemId: item.id, fulfilmentId: shipment.id, sellerId: row.sellerId, customerId: order?.customerId ?? row.customerId,
    status: 'CONFIRMED', createdAt: mockNowIso(), createdByName: actor?.name ?? 'System', version: 1,
  });
  update('returns', row.id, { replacementId: replacement.id, status: 'CLOSED' });
  appendReturnEvent(row, { type: 'REPLACEMENT_CREATED', actorType: actor?.type ?? 'SELLER', actorName: actor?.name ?? 'System', metadata: { replacementId: replacement.id, fulfilmentId: shipment.id } });
  return replacement;
}

export function returnProjection(row) {
  return {
    customerEvidence: visibleReturnEvidence(row),
    policy: returnPolicy(row),
    timeline: returnTimeline(row),
    replacement: row.replacementId ? findById('replacements', row.replacementId) : null,
    refund: row.refundId ? findById('refunds', row.refundId) : null,
    disputes: filter('returnDisputes', (dispute) => dispute.returnId === row.id),
    reverseShipment: row.pickupAwb ? { awb: row.pickupAwb, courierName: row.reverseCourierName ?? null, status: row.status, scheduledFor: row.pickupScheduledFor ?? null, receivedAt: row.receivedAt ?? null, package: row.returnPackage ?? { quantity: 1, contents: row.productName, conditionDeclared: row.reason } } : null,
  };
}
