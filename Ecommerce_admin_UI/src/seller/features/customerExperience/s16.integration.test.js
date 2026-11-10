import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, find, id, insert } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { supportApi } from '../support/api/support.api';
import { customerExperienceApi } from './api/customerExperience.api';

const server = setupServer(...handlers, ...sellerHandlers);
const ADMIN_BASE = `${window.location.origin}/api/admin/v1`;

async function adminCall(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${ADMIN_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signInAdmin() {
  const login = await adminCall('/auth/login', { method: 'POST', body: { email: 'super@arise.test', password: DEMO_PASSWORD } });
  const { challengeId, devHint, stage } = login.json.data;
  const verified = await adminCall(`/auth/2fa/${stage === 'enrol_2fa' ? 'enrol' : 'verify'}`, { method: 'POST', body: { challengeId, code: devHint.code } });
  return verified.json.data.accessToken;
}

function readyMedia(sellerId, fileName) {
  return insert('mediaResources', { id: id('MED', 6), sellerId, fileName, mimeType: 'image/jpeg', previewUrl: `/api/seller/v1/media/preview/${fileName}`, downloadUrl: `/api/seller/v1/media/download/${fileName}`, status: 'READY', createdAt: new Date().toISOString(), version: 1 });
}

describe('S16 customer experience and shared support lifecycle', () => {
  let sellerId;
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (row) => row.email === 'owner@arise.test').sellerId; await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('takes a customer question through seller answer and admin publication', async () => {
    const list = await api.get('/customer-experience/questions', { params: { pageSize: 100 } });
    const question = list.data.find((row) => !row.answers.some((answer) => answer.authorType === 'SELLER'));
    expect(question).toBeTruthy();
    const answer = await customerExperienceApi.answerQuestion(question.id, 'The retail box contains the product, charging cable and warranty card.');
    expect(answer).toMatchObject({ authorType: 'SELLER', status: 'PENDING', sellerId });
    const token = await signInAdmin();
    const moderated = await adminCall(`/answers/${answer.id}/moderate`, { method: 'POST', token, body: { status: 'PUBLISHED' } });
    expect(moderated.status).toBe(200);
    expect(db.answers.find((row) => row.id === answer.id).status).toBe('PUBLISHED');
  });

  it('sends an abusive review into the shared admin queue and projects the decision back to seller', async () => {
    const list = await api.get('/customer-experience/reviews', { params: { pageSize: 100 } });
    const review = list.data.find((row) => !row.abuseReport);
    const report = await customerExperienceApi.reportReview(review.id, { reason: 'The text contains a direct personal threat.', evidenceMediaIds: [] });
    expect(db.abuseReports.find((row) => row.id === report.id)).toMatchObject({ sellerId, status: 'OPEN', targetId: review.id });
    const token = await signInAdmin();
    const decision = await adminCall(`/abuse-reports/${report.id}/decide`, { method: 'POST', token, body: { decision: 'REMOVED', reason: 'Confirmed abusive content.' } });
    expect(decision.status).toBe(200);
    const refreshed = await api.get('/customer-experience/reviews', { params: { q: review.id, pageSize: 10 } });
    expect(refreshed.data[0].abuseReport).toMatchObject({ status: 'REMOVED', decisionReason: 'Confirmed abusive content.' });
  });

  it('raises an order-linked ticket with durable attachment, receives an admin reply and reopens it', async () => {
    const item = db.orderItems.find((row) => row.sellerId === sellerId);
    const proof = readyMedia(sellerId, 'order-proof.jpg');
    const ticket = await supportApi.create({ subject: 'Delivery Issue', text: 'The courier handover scan is missing.', contextType: 'ORDER', contextId: item.orderId, attachments: [proof.id] });
    expect(db.tickets.find((row) => row.id === ticket.id)).toMatchObject({ sellerId, contextType: 'ORDER', contextId: item.orderId });
    const token = await signInAdmin();
    const reply = await adminCall(`/tickets/${ticket.id}/messages`, { method: 'POST', token, body: { text: 'We restored the courier scan.', setStatus: 'RESOLVED', resolutionCode: 'INFORMATION_PROVIDED' } });
    expect(reply.status).toBe(201);
    const detail = await supportApi.detail(ticket.id);
    expect(detail.events.some((event) => event.body === 'We restored the courier scan.')).toBe(true);
    expect(detail.events[0].attachments[0].id).toBe(proof.id);
    const reopened = await supportApi.reopen(ticket.id, 'The shipment timeline still does not show the scan.');
    expect(reopened).toMatchObject({ status: 'OPEN', escalationStatus: 'REOPENED' });
  });

  it('hides admin internal notes and refuses another seller customer conversation', async () => {
    const item = db.orderItems.find((row) => row.sellerId === sellerId);
    const ticket = await supportApi.create({ subject: 'Account Issue', text: 'Please review this account issue.', contextType: 'ORDER', contextId: item.orderId });
    const token = await signInAdmin();
    await adminCall(`/tickets/${ticket.id}/messages`, { method: 'POST', token, body: { text: 'Risk team marker — never expose to requester.', visibility: 'INTERNAL' } });
    const detail = await supportApi.detail(ticket.id);
    expect(detail.events.some((event) => event.body.includes('never expose'))).toBe(false);
    const foreign = db.customerConversations.find((row) => row.sellerId !== sellerId);
    expect(foreign).toBeTruthy();
    await expect(customerExperienceApi.conversation(foreign.id)).rejects.toMatchObject({ status: 404 });
  });

  it('searches the exact admin-published help articles used by the shared CMS', async () => {
    const article = db.helpArticles.find((row) => row.status === 'PUBLISHED');
    const term = article.question.split(' ').find((word) => word.length > 5);
    const sellerResults = await supportApi.help(term);
    expect(sellerResults.map((row) => row.id)).toContain(article.id);
    expect(sellerResults.every((row) => row.status === 'PUBLISHED')).toBe(true);
    const token = await signInAdmin();
    const category = await adminCall(`/help-categories/${article.categoryId}`, { token });
    expect(category.status).toBe(200);
    expect(category.json.data.articles.map((row) => row.id)).toContain(article.id);
  });
});
