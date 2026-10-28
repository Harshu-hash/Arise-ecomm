import { filter, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { canTransitionTicket, derivePriority, nextAssignee, policyFor, routeTicket, slaDeadlines } from '@mocks/engine/tickets';

/**
 * Seller-raised support tickets over the shared `tickets` / `ticketEvents`
 * collections the admin Ticket Queues and workspace read. The seed already
 * anticipates this: tickets carry a `channel` of `SELLER_PANEL` and a
 * `requesterType`, which this module is the first to actually set to
 * `SELLER` — everything else (routing, SLA, the state machine) is the exact
 * engine the admin side uses for customer tickets.
 */

export function ticketRow(t) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    orderId: t.orderId,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    firstRespondedAt: t.firstRespondedAt,
    assigneeName: t.assigneeName,
  };
}

export function sellerTickets(sellerId) {
  return filter('tickets', (t) => t.requesterType === 'SELLER' && t.sellerId === sellerId).map(ticketRow);
}

export function createTicket(seller, body) {
  if (!body?.subject) return { error: 'Choose a subject.' };
  if (!String(body?.text ?? '').trim()) return { error: 'Describe the issue.' };
  const order = body.orderId ? findById('orders', body.orderId) : null;

  const recentTicketCount = filter(
    'tickets',
    (t) => t.sellerId === seller.id && new Date(t.createdAt).getTime() > mockNow() - 30 * 86400_000,
  ).length;
  const priority = derivePriority({ orderValuePaise: order?.grandTotalPaise ?? 0, recentTicketCount });
  const queueId = routeTicket({ subject: body.subject, priority });
  const policy = policyFor(priority, queueId);
  const createdAt = mockNowIso();
  const deadlines = slaDeadlines({ createdAt, policy });
  const assignee = nextAssignee(queueId);

  const ticket = insert('tickets', {
    id: id('TKT', 6),
    subject: body.subject,
    category: body.subject,
    priority,
    status: assignee ? 'OPEN' : 'NEW',
    channel: 'SELLER_PANEL',
    customerId: null,
    customerName: seller.storeName,
    requesterType: 'SELLER',
    sellerId: seller.id,
    orderId: order?.id ?? null,
    queueId,
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? null,
    tags: [],
    ...deadlines,
    firstRespondedAt: null,
    resolutionCode: null,
    csatScore: null,
    csatComment: null,
    dispositionCode: null,
    mergedIntoId: null,
    createdAt,
    resolvedAt: null,
    version: 1,
  });
  insert('ticketEvents', {
    id: id('TKE', 7),
    ticketId: ticket.id,
    type: 'MESSAGE_CUSTOMER',
    authorType: 'SELLER',
    authorName: seller.storeName,
    body: body.text,
    attachments: body.attachments ?? [],
    visibility: 'PUBLIC',
    createdAt,
  });
  return { ticket: ticketRow(ticket) };
}

export function ticketDetail(ticket) {
  return {
    ...ticketRow(ticket),
    events: filter('ticketEvents', (e) => e.ticketId === ticket.id)
      .filter((e) => e.visibility !== 'INTERNAL') // sellers never see internal agent notes
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  };
}

export function reply(ticket, seller, text) {
  if (ticket.status === 'CLOSED') return { error: 'This ticket is closed.' };
  if (!String(text ?? '').trim()) return { error: 'Write a message.' };
  const now = mockNowIso();
  insert('ticketEvents', {
    id: id('TKE', 7),
    ticketId: ticket.id,
    type: 'MESSAGE_CUSTOMER',
    authorType: 'SELLER',
    authorName: seller.storeName,
    body: text,
    attachments: [],
    visibility: 'PUBLIC',
    createdAt: now,
  });
  // A reply from the requester is exactly what moves a ticket off
  // "waiting on you" and back into the agent's queue.
  if (ticket.status === 'PENDING_CUSTOMER') {
    update('tickets', ticket.id, { status: 'OPEN' });
  }
  return { ticket: ticketDetail(findById('tickets', ticket.id)) };
}

export function closeTicket(ticket) {
  if (!canTransitionTicket(ticket.status, 'CLOSED')) return { error: `A ${ticket.status.toLowerCase()} ticket cannot be closed directly.` };
  update('tickets', ticket.id, { status: 'CLOSED' });
  return { ticket: ticketDetail(findById('tickets', ticket.id)) };
}
