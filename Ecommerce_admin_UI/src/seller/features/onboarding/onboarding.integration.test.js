import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { authApi } from '@core/auth/authApi';
import { useSessionStore } from '@core/auth/sessionStore';
import { mediaApi } from '@core/api/foundationApi';
import { handlers as adminHandlers } from '@mocks/handlers';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { onboardingApi } from '@seller/features/onboarding/api/onboarding.api';
import { sellerDashboardApi } from '@seller/features/dashboard/api/dashboard.api';
import { settingsApi } from '@seller/features/settings/api/settings.api';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';

const server = setupServer(...adminHandlers, ...sellerHandlers);
const ADMIN_BASE = `${window.location.origin}/api/admin/v1`;
let clockOffset = 0;

async function adminCall(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${ADMIN_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signInAdmin(email = 'onboarding@arise.test') {
  const login = await adminCall('/auth/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } });
  const { challengeId, devHint, stage } = login.json.data;
  const verified = await adminCall(`/auth/2fa/${stage === 'enrol_2fa' ? 'enrol' : 'verify'}`, { method: 'POST', body: { challengeId, code: devHint.code } });
  return verified.json.data;
}

async function upload(name) {
  const file = new File([`${name} bytes`], `${name}.pdf`, { type: 'application/pdf' });
  const intent = await mediaApi.presign({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, kind: 'DOCUMENT' });
  await mediaApi.upload(intent.uploadUrl, file);
  await mediaApi.complete(intent.uploadId, {});
  clockOffset += 1000;
  updateSettings({ clockOffsetMs: clockOffset });
  return mediaApi.get(intent.mediaId);
}

async function completeApplication() {
  const [gst, pan, signatory, cheque, address] = await Promise.all(['gst', 'pan', 'signatory', 'cheque', 'address'].map(upload));
  await onboardingApi.save({
    business: { storeName: 'Nova Essentials', legalName: 'Nova Essentials Pvt Ltd', businessType: 'Private Limited', registeredAddress: '10 Ring Road, Surat', category: 'Home & Kitchen' },
    tax: { gstin: '24AAAAA0000A1Z5', pan: 'AAAAA0000A' },
    signatory: { name: 'Nova Owner', email: 'newseller@arise.test', phone: '+91 9000000004', contactVerified: true },
    bank: { accountName: 'Nova Essentials Pvt Ltd', accountNumber: '12345678901234', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' },
    pickup: { line1: '10 Ring Road', city: 'Surat', state: 'Gujarat', pincode: '395007', serviceable: true },
    documents: { GST_CERTIFICATE: gst, PAN_CARD: pan, SIGNATORY_ID: signatory, CANCELLED_CHEQUE: cheque, ADDRESS_PROOF: address },
  });
  const agreement = await onboardingApi.agreement();
  await onboardingApi.acceptAgreement(agreement.version);
}

describe('S10 seller onboarding and verified identity', () => {
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(() => { seedAll(); seedSellerAccounts(); resetSettings(); clockOffset = 0; updateSettings({ latencyMs: 0 }); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('submits durable documents, records an agreement receipt and becomes read-only', async () => {
    await signInSeller('newseller@arise.test');
    await completeApplication();
    const submitted = await onboardingApi.submit();
    expect(submitted.status).toBe('UNDER_REVIEW');
    const status = await onboardingApi.status();
    expect(status.sections.every((section) => section.state === 'UNDER_REVIEW')).toBe(true);
    expect(status.documents).toHaveLength(5);
    expect(status.documents.every((document) => document.mediaId && !document.previewUrl?.startsWith('blob:'))).toBe(true);
    expect(status.agreementAcceptance).toMatchObject({ agreementVersion: status.agreement.version });
    await expect(onboardingApi.save({ business: { legalName: 'Changed silently' } })).rejects.toMatchObject({ code: 'UNDER_REVIEW' });
  });

  it('projects an admin document rejection and resubmits only its section', async () => {
    const user = await signInSeller('newseller@arise.test');
    await completeApplication(); await onboardingApi.submit();
    const admin = await signInAdmin();
    const before = await onboardingApi.status();
    const cheque = before.documents.find((document) => document.type === 'CANCELLED_CHEQUE');
    const rejected = await adminCall(`/sellers/${user.sellerId}/documents/${cheque.id}/decide`, { method: 'POST', token: admin.accessToken, body: { approve: false, reason: 'Account holder name is unreadable.' } });
    expect(rejected.status).toBe(200);
    const correction = await onboardingApi.status();
    expect(correction.status).toBe('CLARIFICATION_REQUIRED');
    expect(correction.sections.find((section) => section.key === 'bank')).toMatchObject({ state: 'CLARIFICATION_REQUIRED', adminReason: 'Account holder name is unreadable.' });
    const replacement = await upload('clear-cheque');
    await onboardingApi.resubmitSection('bank', { documents: { CANCELLED_CHEQUE: replacement } });
    const resubmitted = await onboardingApi.status();
    expect(resubmitted.sections.find((section) => section.key === 'bank').state).toBe('SUBMITTED');
    expect(resubmitted.documents.find((document) => document.type === 'CANCELLED_CHEQUE').version).toBe(2);
    expect(resubmitted.sections.filter((section) => section.key !== 'bank').every((section) => section.state === 'UNDER_REVIEW')).toBe(true);
  });

  it('lets admin approval unlock the active seller panel without a manual state edit', async () => {
    const user = await signInSeller('newseller@arise.test');
    await completeApplication(); await onboardingApi.submit();
    const admin = await signInAdmin();
    const status = await onboardingApi.status();
    for (const document of status.documents) {
      const decision = await adminCall(`/sellers/${user.sellerId}/documents/${document.id}/decide`, { method: 'POST', token: admin.accessToken, body: { approve: true } });
      expect(decision.status).toBe(200);
    }
    const approved = await adminCall(`/sellers/${user.sellerId}/application/approve`, { method: 'POST', token: admin.accessToken, body: { tier: 'BRONZE' } });
    expect(approved.status).toBe(200);
    expect((await onboardingApi.status()).status).toBe('APPROVED');
    expect((await authApi.me()).onboardingComplete).toBe(true);
  });

  it('surfaces expired documents on profile and dashboard and supports renewal', async () => {
    await signInSeller();
    const profile = await settingsApi.profile();
    const expired = profile.documents.find((document) => document.expiryState === 'EXPIRED');
    expect(expired).toBeTruthy();
    expect((await sellerDashboardApi.summary()).documentWarnings.some((document) => document.id === expired.id && document.expired)).toBe(true);
    const replacement = await upload('renewed-address-proof');
    const renewed = await settingsApi.renewDocument(expired.id, { mediaId: replacement.id });
    expect(renewed).toMatchObject({ status: 'PENDING', version: expired.version + 1 });
    expect(renewed.previousVersions).toHaveLength(1);
  });

  it('routes a verified legal-name change through admin review', async () => {
    const user = await signInSeller();
    const before = await settingsApi.profile();
    const request = await settingsApi.requestVerifiedChange({ proposedValue: 'Arise Retail India Pvt Ltd', reason: 'Company conversion completed.', evidenceMediaIds: [] });
    expect(request.status).toBe('UNDER_REVIEW');
    expect((await settingsApi.profile()).seller.legalName).toBe(before.seller.legalName);
    const admin = await signInAdmin('super@arise.test');
    const decision = await adminCall(`/sellers/${user.sellerId}/change-requests/${request.id}/decide`, { method: 'POST', token: admin.accessToken, body: { approve: true } });
    expect(decision.status).toBe(200);
    expect((await settingsApi.profile()).seller.legalName).toBe('Arise Retail India Pvt Ltd');
  });
});
