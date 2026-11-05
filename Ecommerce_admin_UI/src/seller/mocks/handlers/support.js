import { http as mswHttp } from 'msw';
import { db, filter, findById, update } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized, validationFailed } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { closeTicket, createTicket, reply, sellerTickets, ticketDetail } from '@seller/mocks/engine/sellerSupport';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

const ownTicket = (user, ticketId) => {
  const t = findById('tickets', ticketId);
  return t && t.requesterType === 'SELLER' && t.sellerId === user.sellerId ? t : null;
};

export const sellerSupportHandlers = [
  mswHttp.get(`${SELLER_BASE}/support/help`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    const term = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? '';
    const rows = filter('helpArticles', (row) => row.status === 'PUBLISHED' && (!term || `${row.question} ${row.answer}`.toLowerCase().includes(term))).map((row) => ({ ...row, category: findById('helpCategories', row.categoryId)?.title }));
    return ok(rows);
  }),

  mswHttp.get(`${SELLER_BASE}/support/context-options`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    return ok([
      ...filter('orderItems', (row) => row.sellerId === c.user.sellerId).slice(0, 50).map((row) => ({ type: 'ORDER', id: row.orderId, label: `${row.orderId} · ${row.name}` })),
      ...filter('offers', (row) => row.sellerId === c.user.sellerId).slice(0, 50).map((row) => ({ type: 'LISTING', id: row.id, label: `${row.id} · ${row.sku}` })),
      ...filter('sellerPayouts', (row) => row.sellerId === c.user.sellerId).slice(0, 20).map((row) => ({ type: 'PAYOUT', id: row.id, label: `${row.id} · payout` })),
      ...filter('returns', (row) => row.sellerId === c.user.sellerId).slice(0, 20).map((row) => ({ type: 'RETURN', id: row.id, label: `${row.id} · ${row.productName ?? row.orderId}` })),
    ]);
  }),

  mswHttp.get(`${SELLER_BASE}/support/incidents`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    return ok(db.supportIncidents);
  }),

  mswHttp.get(`${SELLER_BASE}/support/tickets`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-createdAt' });
    const rows = sellerTickets(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['subject', 'id'],
      filterSpec: { status: 'status' },
      sortable: ['createdAt'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/support/tickets/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const ticket = ownTicket(c.user, params.id);
    if (!ticket) return notFound('That ticket is not on your account.');
    return ok(ticketDetail(ticket));
  }),

  mswHttp.post(`${SELLER_BASE}/support/tickets`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const contexts = body.contextType && body.contextId ? [
      ...filter('orderItems', (row) => row.sellerId === c.user.sellerId).map((row) => ({ type: 'ORDER', id: row.orderId })),
      ...filter('offers', (row) => row.sellerId === c.user.sellerId).map((row) => ({ type: 'LISTING', id: row.id })),
      ...filter('sellerPayouts', (row) => row.sellerId === c.user.sellerId).map((row) => ({ type: 'PAYOUT', id: row.id })),
      ...filter('returns', (row) => row.sellerId === c.user.sellerId).map((row) => ({ type: 'RETURN', id: row.id })),
    ] : [];
    if (body.contextType && !contexts.some((row) => row.type === body.contextType && row.id === body.contextId)) return notFound('That linked record is not on your account.');
    if ((body.attachments ?? []).some((mediaId) => !db.mediaResources.some((row) => row.id === mediaId && row.sellerId === c.user.sellerId && row.status === 'READY'))) return validationFailed({ attachments: 'Every attachment must be a ready media resource owned by your store.' });
    if (body.contextType === 'ORDER') body.orderId = body.contextId;
    const { error, ticket } = createTicket(c.seller, body);
    if (error) return badRequest(error, 'TICKET_INVALID');
    scheduleSave();
    return created(ticket);
  }),

  mswHttp.post(`${SELLER_BASE}/support/tickets/:id/messages`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const ticket = ownTicket(c.user, params.id);
    if (!ticket) return notFound('That ticket is not on your account.');
    const body = await request.json();
    if ((body.attachments ?? []).some((mediaId) => !db.mediaResources.some((row) => row.id === mediaId && row.sellerId === c.user.sellerId && row.status === 'READY'))) return validationFailed({ attachments: 'Every attachment must be a ready media resource owned by your store.' });
    const { error, ticket: updated } = reply(ticket, c.seller, body);
    if (error) return conflict(error, 'TICKET_CLOSED');
    scheduleSave();
    return created(updated);
  }),

  mswHttp.post(`${SELLER_BASE}/support/tickets/:id/close`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const ticket = ownTicket(c.user, params.id);
    if (!ticket) return notFound('That ticket is not on your account.');
    const { error, ticket: updated } = closeTicket(ticket);
    if (error) return conflict(error, 'ILLEGAL_TRANSITION');
    scheduleSave();
    return ok(updated);
  }),

  mswHttp.post(`${SELLER_BASE}/support/tickets/:id/reopen`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const ticket = ownTicket(c.user, params.id); if (!ticket) return notFound('That ticket is not on your account.');
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) return conflict('Only a resolved or closed ticket can be reopened.', 'ILLEGAL_TRANSITION');
    const body = await request.json(); if (!String(body.reason ?? '').trim()) return validationFailed({ reason: 'Explain why you still need help.' });
    update('tickets', ticket.id, { status: 'OPEN', resolvedAt: null, resolutionCode: null, escalationStatus: 'REOPENED' });
    reply(findById('tickets', ticket.id), c.seller, { text: `Reopened: ${body.reason.trim()}`, attachments: body.attachments ?? [] }); scheduleSave();
    return ok(ticketDetail(findById('tickets', ticket.id)));
  }),

  mswHttp.post(`${SELLER_BASE}/support/tickets/:id/callback`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const ticket = ownTicket(c.user, params.id); if (!ticket) return notFound('That ticket is not on your account.');
    if (ticket.status === 'CLOSED') return conflict('Reopen this ticket before requesting a callback.', 'TICKET_CLOSED');
    update('tickets', ticket.id, { callbackRequestedAt: new Date().toISOString(), escalationStatus: 'CALLBACK_REQUESTED' }); scheduleSave();
    return ok(ticketDetail(findById('tickets', ticket.id)));
  }),
];
