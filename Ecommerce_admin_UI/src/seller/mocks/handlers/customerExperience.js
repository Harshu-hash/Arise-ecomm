import { http as mswHttp } from 'msw';
import { filter, findById, id, insert, update } from '@mocks/db/store';
import { listResult, parseListQuery } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized, validationFailed } from '@mocks/engine/respond';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) };
}

const ownItemIds = (sellerId) => new Set(filter('orderItems', (row) => row.sellerId === sellerId).map((row) => row.id));
const ownProductIds = (sellerId) => new Set(filter('offers', (row) => row.sellerId === sellerId).map((row) => findById('variants', row.variantId)?.productId).filter(Boolean));
const reviewOwned = (sellerId, review) => ownItemIds(sellerId).has(review?.orderItemId);
const questionOwned = (sellerId, question) => ownProductIds(sellerId).has(question?.productId);
const prohibited = (text) => /(\b\d{10}\b|https?:\/\/|www\.|@[a-z0-9.-]+\.[a-z]{2,}|whats\s*app|telegram)/i.test(text);

function reviewRow(sellerId, row) {
  const item = findById('orderItems', row.orderItemId);
  const report = filter('abuseReports', (reportRow) => reportRow.targetType === 'REVIEW' && reportRow.targetId === row.id && reportRow.sellerId === sellerId).at(-1) ?? null;
  return { ...row, customerName: 'Verified buyer', sku: item?.sku, sellerReply: row.sellerReply ?? null, abuseReport: report };
}

function questionRow(row) {
  const answers = filter('answers', (answer) => answer.questionId === row.id);
  const dueAt = new Date(new Date(row.askedAt).getTime() + 2 * 86400_000).toISOString();
  return { ...row, customerName: 'Buyer', answers, answerCount: answers.length, responseDueAt: dueAt, slaBreached: !answers.some((answer) => answer.authorType === 'SELLER') && new Date(dueAt).getTime() < mockNow() };
}

export const sellerCustomerExperienceHandlers = [
  mswHttp.get(`${SELLER_BASE}/customer-experience/reviews`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-submittedAt' });
    const rows = filter('reviews', (row) => reviewOwned(c.user.sellerId, row)).map((row) => reviewRow(c.user.sellerId, row));
    const result = listResult(rows, query, { searchFields: ['id', 'productTitle', 'sku', 'text'], filterSpec: { status: 'status', rating: 'rating' }, sortable: ['submittedAt', 'rating'], facetFields: ['status'] });
    return okList(result.items, result.meta);
  }),
  mswHttp.post(`${SELLER_BASE}/customer-experience/reviews/:id/reply`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const review = findById('reviews', params.id);
    if (!review || !reviewOwned(c.user.sellerId, review)) return notFound('That review is not for your store.');
    if (review.sellerReply && !['REJECTED'].includes(review.sellerReply.status)) return conflict('A seller reply is already awaiting moderation or published.', 'REPLY_EXISTS');
    const body = await request.json();
    if (!String(body.text ?? '').trim()) return validationFailed({ text: 'Write a public reply.' });
    if (prohibited(body.text)) return badRequest('Contact details, external links and off-platform requests are prohibited.', 'PROHIBITED_CONTENT');
    update('reviews', review.id, { sellerReply: { text: body.text.trim(), status: 'PENDING', authorName: c.seller.storeName, submittedAt: mockNowIso(), moderatedAt: null, moderationReason: null } });
    scheduleSave(); return ok(reviewRow(c.user.sellerId, findById('reviews', review.id)));
  }),
  mswHttp.post(`${SELLER_BASE}/customer-experience/reviews/:id/report`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const review = findById('reviews', params.id);
    if (!review || !reviewOwned(c.user.sellerId, review)) return notFound('That review is not for your store.');
    if (filter('abuseReports', (row) => row.targetId === review.id && row.sellerId === c.user.sellerId && row.status === 'OPEN').length) return conflict('This review already has an open report.', 'REPORT_EXISTS');
    const body = await request.json();
    if (!String(body.reason ?? '').trim()) return validationFailed({ reason: 'Explain why this content breaches policy.' });
    const report = insert('abuseReports', { id: id('ABR', 5), targetType: 'REVIEW', targetId: review.id, targetExcerpt: review.text.slice(0, 80), reason: body.reason.trim(), reporterCount: 1, reporterType: 'SELLER', sellerId: c.user.sellerId, evidenceMediaIds: body.evidenceMediaIds ?? [], status: 'OPEN', reportedAt: mockNowIso(), decisionReason: null, version: 1 });
    scheduleSave(); return created(report);
  }),
  mswHttp.get(`${SELLER_BASE}/customer-experience/questions`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-askedAt' });
    const rows = filter('questions', (row) => questionOwned(c.user.sellerId, row)).map(questionRow);
    const result = listResult(rows, query, { searchFields: ['id', 'productTitle', 'text'], filterSpec: { status: 'status', slaBreached: { path: 'slaBreached', kind: 'boolean' } }, sortable: ['askedAt', 'responseDueAt'], facetFields: ['status'] });
    return okList(result.items, result.meta);
  }),
  mswHttp.post(`${SELLER_BASE}/customer-experience/questions/:id/answers`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const question = findById('questions', params.id);
    if (!question || !questionOwned(c.user.sellerId, question)) return notFound('That question is not for one of your products.');
    const body = await request.json();
    if (!String(body.text ?? '').trim()) return validationFailed({ text: 'Write an answer.' });
    if (prohibited(body.text)) return badRequest('Contact details, external links and off-platform requests are prohibited.', 'PROHIBITED_CONTENT');
    if (filter('answers', (row) => row.questionId === question.id && row.authorType === 'SELLER' && row.status === 'PENDING').length) return conflict('Your answer is already awaiting moderation.', 'ANSWER_PENDING');
    const answer = insert('answers', { id: id('ANS', 7), questionId: question.id, sellerId: c.user.sellerId, authorType: 'SELLER', authorName: c.seller.storeName, text: body.text.trim(), helpfulVotes: 0, status: 'PENDING', answeredAt: mockNowIso(), version: 1 });
    scheduleSave(); return created(answer);
  }),
  mswHttp.get(`${SELLER_BASE}/customer-experience/messages/policy`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    return ok({ enabled: true, purpose: 'TRANSACTION_ONLY', prohibited: ['Phone numbers', 'Email addresses', 'External links', 'Off-platform payment or contact requests'] });
  }),
  mswHttp.get(`${SELLER_BASE}/customer-experience/messages`, async ({ request }) => {
    const c = ctx(request); if (c.response) return c.response;
    const rows = filter('customerConversations', (row) => row.sellerId === c.user.sellerId).map((row) => ({ ...row, customerId: undefined, unreadCount: filter('customerMessages', (message) => message.conversationId === row.id && message.authorType === 'CUSTOMER' && !message.readAt).length }));
    return ok(rows);
  }),
  mswHttp.get(`${SELLER_BASE}/customer-experience/messages/:id`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const conversation = findById('customerConversations', params.id);
    if (!conversation || conversation.sellerId !== c.user.sellerId) return notFound('That buyer conversation is not on your account.');
    return ok({ ...conversation, customerId: undefined, messages: filter('customerMessages', (row) => row.conversationId === conversation.id && row.moderationStatus !== 'HIDDEN').sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
  }),
  mswHttp.post(`${SELLER_BASE}/customer-experience/messages/:id`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const conversation = findById('customerConversations', params.id);
    if (!conversation || conversation.sellerId !== c.user.sellerId) return notFound('That buyer conversation is not on your account.');
    const body = await request.json();
    if (!String(body.text ?? '').trim()) return validationFailed({ text: 'Write a message.' });
    if (prohibited(body.text)) return badRequest('Contact details, external links and off-platform requests are prohibited.', 'PROHIBITED_CONTENT');
    const message = insert('customerMessages', { id: id('CMSG', 7), conversationId: conversation.id, authorType: 'SELLER', authorName: c.seller.storeName, body: body.text.trim(), attachments: [], moderationStatus: 'VISIBLE', createdAt: mockNowIso(), version: 1 });
    update('customerConversations', conversation.id, { lastMessageAt: message.createdAt }); scheduleSave(); return created(message);
  }),
];
