import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, find, id, insert, update } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { performanceApi } from '../performance/api/performance.api';
import { returnsApi } from './api/returns.api';

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

function media(sellerId, name) {
  return insert('mediaResources', { id: id('MED', 6), sellerId, fileName: name, mimeType: 'image/jpeg', previewUrl: `/evidence/${name}`, downloadUrl: `/evidence/${name}`, status: 'READY', createdAt: new Date().toISOString(), version: 1 });
}

function makeReturn(sellerId, type = 'REFUND') {
  const item = find('orderItems', (row) => row.sellerId === sellerId);
  update('orderItems', item.id, { fulfillmentType: 'SELLER' });
  const evidence = media(sellerId, 'customer-damage.jpg');
  return insert('returns', {
    id: id('RET', 6), orderId: item.orderId, orderItemId: item.id, customerId: db.orders.find((order) => order.id === item.orderId).customerId,
    customerName: 'Customer', sellerId, sellerName: item.sellerName, productName: item.name, variantLabel: item.variantLabel,
    image: item.image, amountPaise: item.linePaise, type, reason: 'Item is damaged or defective', comments: 'Damage visible on opening.', images: [],
    customerEvidence: [{ mediaId: evidence.id, fileName: evidence.fileName, visibility: 'PUBLIC', moderationStatus: 'APPROVED' }, { id: 'hidden', url: '/hidden.jpg', visibility: 'PUBLIC', moderationStatus: 'REJECTED' }],
    status: 'RETURN_REQUESTED', faultAttribution: 'SELLER', qcResult: null, pickupAwb: null, requestedAt: new Date().toISOString(), refundId: null, version: 1,
  });
}

describe('S14 returns, replacements, claims and disputes', () => {
  let sellerId;
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (row) => row.email === 'owner@arise.test').sellerId; await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('shows the same moderated customer evidence to seller and admin', async () => {
    const row = makeReturn(sellerId);
    const seller = await returnsApi.detail(row.id);
    const token = await signInAdmin();
    const admin = await adminCall(`/returns/${row.id}`, { token });
    expect(seller.customerEvidence).toHaveLength(1);
    expect(admin.json.data.customerEvidence).toEqual(seller.customerEvidence);
  });

  it('records seller rejection evidence and exposes admin override rationale', async () => {
    const row = makeReturn(sellerId);
    const proof = media(sellerId, 'seller-pack-photo.jpg');
    await returnsApi.reject(row.id, { reasonCode: 'EVIDENCE_INSUFFICIENT', reason: 'The submitted photo does not show the dispatched item.', evidenceMediaIds: [proof.id] });
    const token = await signInAdmin();
    const override = await adminCall(`/returns/${row.id}/override-rejection`, { method: 'POST', token, body: { reason: 'Customer unboxing video confirms concealed damage.', evidenceMediaIds: ['MED-ADMIN'] } });
    expect(override.status).toBe(200);
    const detail = await returnsApi.detail(row.id);
    expect(detail.status).toBe('RETURN_APPROVED');
    expect(detail.overrideReason).toMatch(/unboxing video/i);
    expect(detail.timeline.some((event) => event.type === 'REJECTION_OVERRIDDEN')).toBe(true);
  });

  it('creates a separate replacement fulfilment visible in shared order and shipment records', async () => {
    const row = makeReturn(sellerId, 'REPLACEMENT');
    await returnsApi.approve(row.id);
    await returnsApi.receive(row.id);
    const completed = await returnsApi.qc(row.id, { result: 'PASS', notes: 'Complete and unused' });
    expect(completed.refundId).toBeFalsy();
    expect(completed.replacement).toBeTruthy();
    expect(db.orderItems.some((item) => item.replacementForReturnId === row.id)).toBe(true);
    expect(db.shipments.some((shipment) => shipment.replacementForReturnId === row.id)).toBe(true);
  });

  it('requires structured notes and media for failed QC and never creates a refund', async () => {
    const row = makeReturn(sellerId);
    await returnsApi.approve(row.id);
    await returnsApi.receive(row.id);
    await expect(returnsApi.qc(row.id, { result: 'FAIL', notes: 'Used' })).rejects.toMatchObject({ code: 'RETURN_ACTION_INVALID' });
    const proof = media(sellerId, 'qc-serial.jpg');
    const failed = await returnsApi.qc(row.id, { result: 'FAIL', reasonCode: 'SERIAL_MISMATCH', notes: 'Serial does not match dispatched unit.', evidenceMediaIds: [proof.id] });
    expect(failed.status).toBe('QC_FAILED');
    expect(failed.refundId).toBeFalsy();
    expect(db.refunds.some((refund) => refund.returnId === row.id)).toBe(false);
  });

  it('projects an approved seller claim as an identified payout adjustment', async () => {
    const row = makeReturn(sellerId);
    const proof = media(sellerId, 'claim-proof.jpg');
    const claim = await performanceApi.createClaim({ type: 'RETURN_DAMAGED', orderId: row.orderId, returnId: row.id, amountClaimed: 500, evidence: 'QC photos show customer damage.', evidenceMediaIds: [proof.id] });
    const token = await signInAdmin();
    const decided = await adminCall(`/seller-claims/${claim.id}/decide`, { method: 'POST', token, body: { decision: 'APPROVED' } });
    expect(decided.status).toBe(200);
    const adjustment = db.payoutAdjustments.find((item) => item.referenceId === claim.id);
    expect(adjustment).toMatchObject({ type: 'SELLER_CLAIM_REIMBURSEMENT', amountPaise: 50000, status: 'APPLIED' });
    expect(decided.json.data.payoutAdjustmentId).toBe(adjustment.id);
    const adjustments = await api.get('/finance/adjustments');
    expect(adjustments.data.some((item) => item.id === adjustment.id && item.referenceId === claim.id)).toBe(true);
  });
});
