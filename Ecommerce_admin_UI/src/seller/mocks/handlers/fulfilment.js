import { http as mswHttp } from 'msw';
import { db, findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  createInbound,
  createRemoval,
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
      filterSpec: { warehouseId: 'warehouseId' },
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
    return ok({ ...inboundRow(row), lines: db.inboundLines.filter((l) => l.consignmentId === row.id) });
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
    scheduleSave();
    return ok(consignment);
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
