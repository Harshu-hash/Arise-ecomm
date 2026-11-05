import { http as mswHttp } from 'msw';
import { db, filter, findById, id, insert } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  createInbound,
  createRemoval,
  changeSellerStock,
  decideReturn,
  inboundRow,
  inventoryRow,
  returnRow,
  returnStage,
  sellerInbound,
  sellerInventory,
  sellerReturns,
  transitionInbound,
} from '@seller/mocks/engine/sellerFulfilment';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

const own = (collection, user, recordId) => {
  const r = findById(collection, recordId);
  return r && r.sellerId === user.sellerId ? r : null;
};

function returnAction(action) {
  return async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const r = own('returns', c.user, params.id);
    if (!r) return notFound('That return is not on your account.');
    const body = await request.json().catch(() => ({}));
    const { error, return: updated } = decideReturn(r, action, body, c.user);
    if (error) return conflict(error, 'RETURN_ACTION_INVALID');
    scheduleSave();
    return ok(updated);
  };
}

export const sellerFulfilmentHandlers = [
  /* ------------------------------------------------------------- returns */
  mswHttp.get(`${SELLER_BASE}/returns`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    let rows = sellerReturns(c.user.sellerId);
    if (stage && stage !== 'all') rows = rows.filter((r) => r.stage === stage);
    const query = parseListQuery(url, { defaultSort: '-requestedAt' });
    const { items, meta } = listResult(rows, query, {
      searchFields: ['id', 'orderId', 'productName', 'customerName'],
      filterSpec: { status: 'status', type: 'type' },
      sortable: ['requestedAt', 'amountPaise'],
      facetFields: ['status', 'type'],
    });
    const all = sellerReturns(c.user.sellerId);
    return okList(items, {
      ...meta,
      counts: {
        REQUESTED: all.filter((r) => returnStage(r.status) === 'REQUESTED').length,
        IN_PROGRESS: all.filter((r) => returnStage(r.status) === 'IN_PROGRESS').length,
        COMPLETED: all.filter((r) => returnStage(r.status) === 'COMPLETED').length,
      },
    });
  }),

  mswHttp.get(`${SELLER_BASE}/returns-analytics`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const rows = sellerReturns(c.user.sellerId);
    const group = (key) => Object.values(rows.reduce((acc, row) => {
      const value = row[key] ?? 'UNKNOWN';
      acc[value] ??= { key: value, count: 0, amountPaise: 0 };
      acc[value].count += 1;
      acc[value].amountPaise += row.amountPaise ?? 0;
      return acc;
    }, {})).sort((a, b) => b.amountPaise - a.amountPaise);
    return ok({ totalReturns: rows.length, financialImpactPaise: rows.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0), bySku: group('productName'), byReason: group('reason'), byFault: group('faultAttribution') });
  }),

  mswHttp.get(`${SELLER_BASE}/returns/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const r = own('returns', c.user, params.id);
    if (!r) return notFound('That return is not on your account.');
    const order = findById('orders', r.orderId);
    return ok({ ...returnRow(r), order: order ? { id: order.id, placedAt: order.placedAt, paymentMethod: order.paymentMethod } : null });
  }),

  mswHttp.post(`${SELLER_BASE}/returns/:id/approve`, returnAction('approve')),
  mswHttp.post(`${SELLER_BASE}/returns/:id/reject`, returnAction('reject')),
  mswHttp.post(`${SELLER_BASE}/returns/:id/receive`, returnAction('receive')),
  mswHttp.post(`${SELLER_BASE}/returns/:id/qc`, returnAction('qc')),

  mswHttp.post(`${SELLER_BASE}/returns/:id/disputes`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = own('returns', c.user, params.id);
    if (!row) return notFound('That return is not on your account.');
    if (!['RETURN_REJECTED', 'QC_FAILED', 'CLOSED'].includes(row.status)) return conflict('A dispute can be opened after rejection, failed QC or closure.', 'RETURN_DISPUTE_NOT_ALLOWED');
    const body = await request.json();
    if (!String(body?.reason ?? '').trim() || !(body?.evidenceMediaIds?.length)) return badRequest('A dispute needs a reason and durable evidence.', 'DISPUTE_EVIDENCE_REQUIRED');
    const dispute = insert('returnDisputes', { id: id('RDP', 6), returnId: row.id, orderId: row.orderId, sellerId: c.user.sellerId, reasonCode: body.reasonCode ?? 'OTHER', reason: body.reason.trim(), evidenceMediaIds: body.evidenceMediaIds, amountClaimedPaise: Number(body.amountClaimedPaise) || row.amountPaise, status: 'OPEN', createdAt: mockNowIso(), resolution: null, version: 1 });
    const claim = insert('sellerClaims', { id: id('CLM', 6), sellerId: c.user.sellerId, sellerName: c.seller.storeName, type: body.reasonCode === 'WRONG_ITEM_RETURNED' ? 'WRONG_ITEM_RETURNED' : 'RETURN_DAMAGED', typeLabel: 'Return dispute reimbursement', orderId: row.orderId, returnId: row.id, disputeId: dispute.id, amountClaimedPaise: dispute.amountClaimedPaise, amountApprovedPaise: null, status: 'SUBMITTED', submittedAt: mockNowIso(), evidence: [body.reason.trim()], evidenceMediaIds: body.evidenceMediaIds, linkedEntities: [{ type: 'ORDER', id: row.orderId }, { type: 'RETURN', id: row.id }, { type: 'RETURN_DISPUTE', id: dispute.id }], timeline: [{ type: 'SUBMITTED', at: mockNowIso(), actorName: c.seller.storeName, note: body.reason.trim(), evidenceMediaIds: body.evidenceMediaIds }], decisionReason: null, version: 1 });
    dispute.claimId = claim.id;
    scheduleSave();
    return created(dispute);
  }),

  /* ----------------------------------------------------------- inventory */
  mswHttp.get(`${SELLER_BASE}/inventory`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    let rows = sellerInventory(c.user.sellerId);
    if (url.searchParams.get('lowStock') === 'true') rows = rows.filter((r) => r.lowStock);
    if (url.searchParams.get('aged') === 'true') rows = rows.filter((r) => r.aged);
    const query = parseListQuery(url, { defaultSort: '-sellable' });
    const { items, meta } = listResult(rows, query, {
      searchFields: ['sku', 'productTitle'],
      filterSpec: { warehouseId: 'warehouseId', fulfillmentType: 'fulfillmentType' },
      sortable: ['sellable', 'available', 'daysOfCover', 'oldestUnitDays'],
    });
    const all = sellerInventory(c.user.sellerId);
    return okList(items, {
      ...meta,
      counts: {
        skus: all.length,
        lowStock: all.filter((r) => r.lowStock).length,
        aged: all.filter((r) => r.aged).length,
        unitsSellable: all.reduce((n, r) => n + r.sellable, 0),
      },
    });
  }),

  mswHttp.get(`${SELLER_BASE}/inventory/recommendations`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const rows = sellerInventory(c.user.sellerId).map((row) => ({
      ...row,
      targetDaysCover: 30,
      recommendedQty: Math.max(0, Math.ceil((row.dailyVelocity || 0) * 30 - row.available)),
    })).filter((row) => row.recommendedQty > 0).sort((a, b) => b.recommendedQty - a.recommendedQty);
    return ok(rows);
  }),

  mswHttp.get(`${SELLER_BASE}/inventory/removals`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(filter('removalOrders', (row) => row.sellerId === c.user.sellerId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
  }),

  mswHttp.get(`${SELLER_BASE}/inventory/:id/ledger`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const inv = own('inventory', c.user, params.id);
    if (!inv) return notFound('That inventory record is not on your account.');
    return ok({ inventory: inventoryRow(inv), entries: filter('inventoryLedger', (row) => row.inventoryId === inv.id).sort((a, b) => b.at.localeCompare(a.at)) });
  }),

  mswHttp.patch(`${SELLER_BASE}/inventory/:id/stock`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const inv = own('inventory', c.user, params.id);
    if (!inv) return notFound('That inventory record is not on your account.');
    if ((inv.fulfillmentType ?? 'ARISE') !== 'SELLER') return conflict('FBA stock changes only through receiving, adjustment, return or removal movements.', 'FBA_STOCK_IMMUTABLE');
    const result = changeSellerStock(inv, await request.json());
    if (result.error) return conflict(result.error, result.code, result.current ? { details: { current: result.current } } : undefined);
    scheduleSave();
    return ok(result.inventory);
  }),

  mswHttp.post(`${SELLER_BASE}/inventory/bulk-jobs`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    if (!changes.length) return badRequest('Add at least one stock change.', 'BULK_EMPTY');
    const results = changes.map((change, index) => {
      const inv = own('inventory', c.user, change.inventoryId);
      if (!inv || (inv.fulfillmentType ?? 'ARISE') !== 'SELLER') return { index, inventoryId: change.inventoryId, status: 'FAILED', code: 'NOT_EDITABLE', message: 'Self-ship inventory not found.' };
      const result = changeSellerStock(inv, change);
      return result.error
        ? { index, inventoryId: inv.id, status: 'FAILED', code: result.code, message: result.error, requested: change }
        : { index, inventoryId: inv.id, status: 'SUCCEEDED', inventory: result.inventory };
    });
    const job = insert('jobs', { id: id('JOB', 6), type: 'SELLER_INVENTORY_BULK', sellerId: c.user.sellerId, status: results.some((r) => r.status === 'FAILED') ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', results, createdAt: mockNowIso(), completedAt: mockNowIso(), version: 1 });
    scheduleSave();
    return created(job);
  }),

  mswHttp.post(`${SELLER_BASE}/inventory/bulk-jobs/:id/retry`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const job = findById('jobs', params.id);
    if (!job || job.sellerId !== c.user.sellerId || job.type !== 'SELLER_INVENTORY_BULK') return notFound('That bulk stock job is not on your account.');
    const corrections = (await request.json().catch(() => ({})))?.changes ?? [];
    const failed = job.results.filter((row) => row.status === 'FAILED');
    const changes = failed.map((row) => corrections.find((item) => item.inventoryId === row.inventoryId) ?? row.requested);
    const results = changes.map((change, index) => {
      const inv = own('inventory', c.user, change.inventoryId);
      if (!inv) return { index, inventoryId: change.inventoryId, status: 'FAILED', code: 'NOT_FOUND' };
      const result = changeSellerStock(inv, change);
      return result.error ? { index, inventoryId: inv.id, status: 'FAILED', code: result.code, message: result.error, requested: change } : { index, inventoryId: inv.id, status: 'SUCCEEDED', inventory: result.inventory };
    });
    const retry = insert('jobs', { id: id('JOB', 6), parentJobId: job.id, type: job.type, sellerId: c.user.sellerId, status: results.some((r) => r.status === 'FAILED') ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', results, createdAt: mockNowIso(), completedAt: mockNowIso(), version: 1 });
    scheduleSave();
    return created(retry);
  }),

  mswHttp.post(`${SELLER_BASE}/inventory/:id/removal`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const inv = own('inventory', c.user, params.id);
    if (!inv) return notFound('That inventory record is not on your account.');
    const body = await request.json();
    const { error, removal } = createRemoval(inventoryRow(inv), body);
    if (error) return conflict(error, 'REMOVAL_INVALID');
    scheduleSave();
    return created(removal);
  }),

  /* ------------------------------------------------------------- inbound */
  mswHttp.get(`${SELLER_BASE}/inbound`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-createdAt' });
    const rows = sellerInbound(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['id', 'warehouseName', 'invoiceNo'],
      filterSpec: { status: 'status', warehouseId: 'warehouseId' },
      sortable: ['createdAt', 'declaredUnits'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/inbound/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = own('inboundConsignments', c.user, params.id);
    if (!row) return notFound('That consignment is not on your account.');
    return ok({
      ...inboundRow(row),
      lines: db.inboundLines.filter((l) => l.consignmentId === row.id),
      disputes: filter('inboundDisputes', (item) => item.consignmentId === row.id),
      documents: filter('fulfilmentDocuments', (item) => item.entityType === 'INBOUND' && item.entityId === row.id),
      ledger: filter('inventoryLedger', (item) => item.reference === row.id),
      timeline: [
        { status: 'DRAFT', at: row.createdAt, label: 'Plan created' },
        row.submittedAt && { status: 'SUBMITTED', at: row.submittedAt, label: 'Plan submitted' },
        row.appointmentAt && { status: 'APPOINTMENT_BOOKED', at: row.appointmentAt, label: 'Appointment booked' },
        row.receivedAt && { status: 'RECEIVED', at: row.receivedAt, label: 'Receiving completed' },
      ].filter(Boolean),
    });
  }),

  mswHttp.post(`${SELLER_BASE}/inbound`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, consignment } = createInbound(c.seller, body);
    if (error) return conflict(error, 'INBOUND_INVALID');
    scheduleSave();
    return created(consignment);
  }),

  mswHttp.post(`${SELLER_BASE}/inbound/:id/submit`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = own('inboundConsignments', c.user, params.id);
    if (!row) return notFound('That consignment is not on your account.');
    const { error, consignment } = transitionInbound(row, 'submit');
    if (error) return conflict(error, 'INBOUND_STATE');
    for (const kind of ['INBOUND_PLAN', 'CARTON_LABELS']) insert('fulfilmentDocuments', { id: id('FDOC', 6), entityType: 'INBOUND', entityId: row.id, sellerId: c.user.sellerId, kind, fileName: `${row.id}-${kind.toLowerCase()}.pdf`, status: 'READY', generatedAt: mockNowIso(), version: 1 });
    scheduleSave();
    return ok(consignment);
  }),

  mswHttp.post(`${SELLER_BASE}/inbound/:id/disputes`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = own('inboundConsignments', c.user, params.id);
    if (!row) return notFound('That consignment is not on your account.');
    if (!row.hasDiscrepancy && inboundRow(row).discrepancyUnits <= 0) return conflict('A dispute can be opened after receiving records a discrepancy.', 'NO_INBOUND_DISCREPANCY');
    const body = await request.json();
    if (!String(body?.reason ?? '').trim()) return badRequest('Describe the discrepancy.', 'DISPUTE_REASON_REQUIRED');
    const dispute = insert('inboundDisputes', { id: id('IDP', 6), consignmentId: row.id, sellerId: c.user.sellerId, type: ['SHORTAGE', 'DAMAGE', 'UNEXPECTED_SKU'].includes(body.type) ? body.type : 'SHORTAGE', lineId: body.lineId ?? null, unexpectedSku: body.type === 'UNEXPECTED_SKU' ? body.unexpectedSku ?? null : null, reason: body.reason.trim(), evidenceMediaIds: body.evidenceMediaIds ?? [], status: 'OPEN', createdAt: mockNowIso(), resolution: null, version: 1 });
    scheduleSave();
    return created(dispute);
  }),

  mswHttp.post(`${SELLER_BASE}/inbound/:id/cancel`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = own('inboundConsignments', c.user, params.id);
    if (!row) return notFound('That consignment is not on your account.');
    const { error, consignment } = transitionInbound(row, 'cancel');
    if (error) return conflict(error, 'INBOUND_STATE');
    scheduleSave();
    return ok(consignment);
  }),

  /* ---------------------------------------------- warehouses (for inbound) */
  mswHttp.get(`${SELLER_BASE}/warehouses`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const rows = db.warehouses
      .filter((w) => w.type === 'FULFILMENT' && w.status !== 'CLOSED')
      .map((w) => ({ id: w.id, code: w.code, name: w.name, city: w.city, state: w.state, inboundPaused: Boolean(w.inboundPaused) }));
    return ok(rows);
  }),
];
