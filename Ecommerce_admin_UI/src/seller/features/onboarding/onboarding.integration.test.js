import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { mediaApi } from '@core/api/foundationApi';
import { handlers as adminHandlers } from '@mocks/handlers';
import { db } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerAuthApi } from '@seller/features/auth/api/auth.api';
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

async function apply(email = 'applicant@arise.test', phone = '9999999991') {
  const emailOtp = await sellerAuthApi.sendRegistrationOtp({ kind: 'email', value: email });
  const emailVerified = await sellerAuthApi.verifyRegistrationOtp({ challengeId: emailOtp.challengeId, code: emailOtp.devHint.code });
  const phoneOtp = await sellerAuthApi.sendRegistrationOtp({ kind: 'phone', value: phone });
  const phoneVerified = await sellerAuthApi.verifyRegistrationOtp({ challengeId: phoneOtp.challengeId, code: phoneOtp.devHint.code });
  const form = new FormData();
  Object.entries({ name: 'Quick Owner', shopName: 'Quick Mart', email, phone, password: 'Arise@123456', locality: 'Vesu', pincode: '395007', city: 'Surat', state: 'Gujarat', address: '10 Ring Road', lat: '21.1702', lng: '72.8311', radiusKm: '5', emailVerificationToken: emailVerified.verificationToken, phoneVerificationToken: phoneVerified.verificationToken }).forEach(([key, value]) => form.append(key, value));
  ['tradeLicense', 'gstCertificate', 'idProof'].forEach((field) => form.append(field, new File([field], `${field}.pdf`, { type: 'application/pdf' })));
  return sellerAuthApi.register(form);
}

describe('S10 seller onboarding and verified identity', () => {
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(() => { seedAll(); seedSellerAccounts(); resetSettings(); clockOffset = 0; updateSettings({ latencyMs: 0 }); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('creates one submitted application with verified contacts and three mandatory documents', async () => {
    const submitted = await apply();
    expect(submitted).toMatchObject({ applicationStatus: 'UNDER_REVIEW', email: 'applicant@arise.test' });
    const user = db.sellerUsers.find((row) => row.email === submitted.email);
    const application = db.sellerOnboarding.find((row) => row.sellerId === user.sellerId);
    expect(application).toMatchObject({ status: 'UNDER_REVIEW', flowVersion: 'QUICK_COMMERCE_V1', step: 3 });
    expect(db.kycDocuments.filter((document) => document.sellerId === user.sellerId).map((document) => document.type)).toEqual(['TRADE_LICENSE', 'GST_CERTIFICATE', 'ID_PROOF']);
  });

  it('blocks pending login and carries status details for the public pending page', async () => {
    await apply();
    await expect(sellerAuthApi.login({ emailOrPhone: 'applicant@arise.test', password: 'Arise@123456' })).rejects.toMatchObject({ status: 403, details: { applicationStatus: 'UNDER_REVIEW' } });
  });

  it('lets one admin approval unlock login and first-time 2FA enrolment', async () => {
    await apply();
    const user = db.sellerUsers.find((row) => row.email === 'applicant@arise.test');
    const admin = await signInAdmin();
    const approved = await adminCall(`/sellers/${user.sellerId}/application/approve`, { method: 'POST', token: admin.accessToken, body: { tier: 'BRONZE' } });
    expect(approved.status).toBe(200);
    const challenge = await sellerAuthApi.login({ emailOrPhone: 'applicant@arise.test', password: 'Arise@123456' });
    expect(challenge.stage).toBe('enrol_2fa');
    expect(challenge.accessToken).toBeUndefined();
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
