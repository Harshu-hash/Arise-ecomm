import { http as mswHttp } from 'msw';
import { findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { advanceShipment, cancelShipment, orderTimeline, sellerOrders, shipmentRow, stageFor } from '@seller/mocks/engine/sellerOrders';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user };
}

function ownShipment(user, shipmentId) {
  const s = findById('shipments', shipmentId);
  if (!s || s.sellerId !== user.sellerId) return null;
  return s;
}

function runAction(action) {
  return async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const shipment = ownShipment(c.user, params.id);
    if (!shipment) return notFound('That order is not on your account.');
    const { error, shipment: updated } = advanceShipment(shipment, action, c.user.name);
    if (error) return conflict(error, 'ILLEGAL_TRANSITION');
    scheduleSave();
    return ok(shipmentRow(updated, { revealContact: true }));
  };
}

export const sellerOrderHandlers = [
  /* ------------------------------------------------------------ my orders */
  mswHttp.get(`${SELLER_BASE}/orders`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-placedAt' });
    let rows = sellerOrders(c.user.sellerId);
    // A convenience "stage" filter powers the tabs without many status values.
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    if (stage && stage !== 'all') rows = rows.filter((r) => r.stage === stage);

    const { items, meta } = listResult(rows, query, {
      searchFields: ['orderId', 'id', 'awb', 'customerName'],
      filterSpec: {
        status: 'status',
        fulfillmentType: 'fulfillmentType',
        slaBreached: (row, v) => (String(v) === 'true' ? row.slaBreached : true),
      },
      sortable: ['placedAt', 'dispatchByAt', 'totalPaise'],
      facetFields: ['status'],
    });

    const all = sellerOrders(c.user.sellerId);
    return okList(items, {
      ...meta,
      counts: {
        NEW: all.filter((r) => r.stage === 'NEW').length,
        PROCESSING: all.filter((r) => r.stage === 'PROCESSING').length,
        SHIPPED: all.filter((r) => r.stage === 'SHIPPED').length,
        DELIVERED: all.filter((r) => r.stage === 'DELIVERED').length,
        RTO: all.filter((r) => r.stage === 'RTO').length,
        CANCELLED: all.filter((r) => r.stage === 'CANCELLED').length,
        breaching: all.filter((r) => r.slaBreached).length,
      },
    });
  }),

  /* --------------------------------------------------------- order detail */
  mswHttp.get(`${SELLER_BASE}/orders/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const shipment = ownShipment(c.user, params.id);
    if (!shipment) return notFound('That order is not on your account.');
    const order = findById('orders', shipment.orderId);
    return ok({
      ...shipmentRow(shipment, { revealContact: true }),
      address: order?.address ?? null,
      priceDetails: order?.priceDetails ?? null,
      timeline: orderTimeline(shipment.id),
    });
  }),

  /* ----------------------------------------------- fulfilment transitions */
  mswHttp.post(`${SELLER_BASE}/orders/:id/confirm`, runAction('confirm')),
  mswHttp.post(`${SELLER_BASE}/orders/:id/pack`, runAction('pack')),
  mswHttp.post(`${SELLER_BASE}/orders/:id/manifest`, runAction('manifest')),
  mswHttp.post(`${SELLER_BASE}/orders/:id/dispatch`, runAction('dispatch')),

  /* ------------------------------------------------------------- cancel */
  mswHttp.post(`${SELLER_BASE}/orders/:id/cancel`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const shipment = ownShipment(c.user, params.id);
    if (!shipment) return notFound('That order is not on your account.');
    const body = await request.json().catch(() => ({}));
    const { error, shipment: updated } = cancelShipment(shipment, body?.reason, c.user);
    if (error) return conflict(error, 'NOT_CANCELLABLE');
    scheduleSave();
    return ok(shipmentRow(updated, { revealContact: true }));
  }),

  /* --------------------------------------------------- bulk fulfilment */
  mswHttp.post(`${SELLER_BASE}/orders/bulk`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const action = body?.action;
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (!['confirm', 'pack', 'manifest', 'dispatch'].includes(action)) return badRequest('Unknown bulk action.', 'BAD_ACTION');

    let done = 0;
    const failures = [];
    for (const sid of ids) {
      const shipment = ownShipment(c.user, sid);
      if (!shipment) {
        failures.push({ id: sid, reason: 'Not found' });
        continue;
      }
      const { error } = advanceShipment(shipment, action, c.user.name);
      if (error) failures.push({ id: sid, reason: error });
      else done += 1;
    }
    scheduleSave();
    return ok({ done, failed: failures.length, failures });
  }),
];

export { stageFor };
