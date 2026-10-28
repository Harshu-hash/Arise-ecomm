import { http as mswHttp } from 'msw';
import { findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
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
    const { error, ticket: updated } = reply(ticket, c.seller, body?.text);
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
];
