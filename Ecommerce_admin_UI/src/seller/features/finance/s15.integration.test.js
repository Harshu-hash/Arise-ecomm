import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, find, id, insert, update } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { financeApi } from './api/finance.api';

const server = setupServer(...handlers, ...sellerHandlers);
const ADMIN_BASE = `${window.location.origin}/api/admin/v1`;

async function adminCall(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${ADMIN_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signInAdmin() {
  // Admin sign-in no longer has a 2FA step; login returns the token directly.
  const login = await adminCall('/auth/login', { method: 'POST', body: { email: 'super@arise.test', password: DEMO_PASSWORD } });
  return login.json.data.accessToken;
}

describe('S15 settlements, reconciliation and finance documents', () => {
  let sellerId;
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (row) => row.email === 'owner@arise.test').sellerId; await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('makes every payout net exactly equal its settlement and adjustment detail lines', async () => {
    const payout = db.sellerPayouts.find((row) => row.sellerId === sellerId);
    const detail = await financeApi.payoutDetail(payout.id);
    expect(detail.lines.reduce((sum, row) => sum + row.netPaise, 0)).toBe(detail.netPaise);
    expect(detail.reconciliationTotalPaise).toBe(detail.netPaise);
  });

  it('records generation failure and supports retry before exposing a backend download artifact', async () => {
    const invoice = db.invoices.find((row) => row.sellerId === sellerId);
    const failed = await financeApi.generateDocument({ kind: invoice.type, entityType: 'INVOICE', entityId: invoice.id, simulateFailure: true });
    expect(failed).toMatchObject({ status: 'FAILED', downloadUrl: null });
    const ready = await financeApi.retryDocument(failed.id);
    expect(ready.status).toBe('READY');
    expect(ready.downloadUrl).toContain(`/finance/documents/${failed.id}/download`);
  });

  it('shows a failed transfer with exact UTR state and bank correction action', async () => {
    const payout = db.sellerPayouts.find((row) => row.sellerId === sellerId);
    update('sellerPayouts', payout.id, { status: 'FAILED', utr: null, failureReason: 'Beneficiary account is closed.' });
    const detail = await financeApi.payoutDetail(payout.id);
    expect(detail.bankTransfer).toMatchObject({ utrStatus: 'RETURNED', failureReason: 'Beneficiary account is closed.', correctionAction: { to: '/settings/bank' } });
    expect(detail.bankTransfer.maskedAccount).toMatch(/•{2}\d{4}/);
  });

  it('turns an approved deduction dispute into an APPROVED reversal adjustment', async () => {
    const line = db.settlementLines.find((row) => row.sellerId === sellerId && !row.settledAt);
    const evidence = insert('mediaResources', { id: id('MED', 6), sellerId, fileName: 'fee-proof.jpg', status: 'READY', createdAt: new Date().toISOString(), version: 1 });
    const dispute = await financeApi.disputeLine(line.id, { reasonCode: 'COMMISSION_INCORRECT', reason: 'The contracted rate is lower.', disputedPaise: 321, evidenceMediaIds: [evidence.id] });
    const token = await signInAdmin();
    const resolution = await adminCall(`/finance-disputes/${dispute.id}/resolve`, { method: 'POST', token, body: { decision: 'APPROVE', reason: 'Contract and rate card confirm the lower rate.' } });
    expect(resolution.status).toBe(200);
    // Per-order-item settlements have no batches; an approved dispute simply
    // posts an APPROVED reversal adjustment tied to the seller.
    const adjustment = db.payoutAdjustments.find((row) => row.referenceId === dispute.id);
    expect(adjustment).toMatchObject({ amountPaise: 321, status: 'APPROVED', sellerId });
  });

  it('traces return, refund, weight correction and payout adjustment effects to the source order', async () => {
    const line = db.settlementLines.find((row) => row.sellerId === sellerId);
    const item = db.orderItems.find((row) => row.id === line.orderItemId);
    const refund = insert('refunds', { id: id('RFN', 6), orderId: line.orderId, amountPaise: 450, initiatedAt: new Date().toISOString(), status: 'SUCCESS', version: 1 });
    const returned = insert('returns', { id: id('RET', 6), sellerId, orderId: line.orderId, orderItemId: item.id, amountPaise: 450, refundId: refund.id, requestedAt: new Date().toISOString(), status: 'REFUNDED', version: 1 });
    const weight = insert('weightDisputes', { id: id('WDP', 6), sellerId, orderId: line.orderId, differencePaise: 125, disputedAt: new Date().toISOString(), status: 'RESOLVED', version: 1 });
    insert('payoutAdjustments', { id: id('ADJ', 5), sellerId, orderId: line.orderId, returnId: returned.id, referenceId: weight.id, type: 'WEIGHT_CORRECTION', amountPaise: 125, note: 'Weight correction', status: 'APPLIED', raisedAt: new Date().toISOString(), version: 1 });
    const detail = await financeApi.reconciliationDetail(line.id);
    expect(detail.trace.map((event) => event.type)).toEqual(expect.arrayContaining(['ORDER_DELIVERED', 'RETURN', 'REFUND', 'WEIGHT_DISPUTE', 'ADJUSTMENT']));
  });
});
