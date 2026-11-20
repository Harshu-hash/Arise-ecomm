import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, id, insert } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerBannerAdHandlers } from '@seller/mocks/handlers/bannerAds';
import { sellerAuthHandlers } from '@seller/mocks/handlers/auth';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';

const server = setupServer(...handlers, ...sellerAuthHandlers, ...sellerBannerAdHandlers);
const origin = window.location.origin;

describe('paid banner request lifecycle', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => { seedAll(); seedSellerAccounts(); resetSettings(); updateSettings({ latencyMs: 0 }); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('keeps the paid price snapshot and refunds an admin rejection', async () => {
    setApiBaseUrl('/api/seller/v1');
    const seller = await signInSeller();
    const token = useSessionStore.getState().accessToken;
    const placement = db.bannerAdPlacements[0];
    const media = ['mobile'].map((name) => insert('mediaResources', { id: id('MED', 8), sellerId: seller.sellerId, fileName: `${name}.png`, previewUrl: `/media/${name}`, status: 'READY', version: 1 }));
    const create = await fetch(`${origin}/api/seller/v1/banner-ads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': 'test-banner-payment' },
      body: JSON.stringify({ campaignName: 'Test banner', placementId: placement.id, startsOn: '2099-01-01', endsOn: '2099-01-03', destinationType: 'SHOP', destinationValue: seller.sellerId, mobileCreative: { mediaId: media[0].id }, paymentMethod: 'UPI' }),
    });
    expect(create.status).toBe(201);
    const booking = (await create.json()).data;
    expect(booking).toMatchObject({ status: 'PENDING_REVIEW', paymentStatus: 'PAID', days: 3, totalPaise: 531000 });

    const login = await fetch(`${origin}/api/admin/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'super@arise.test', password: DEMO_PASSWORD }) });
    const admin = (await login.json()).data;
    const decision = await fetch(`${origin}/api/admin/v1/banner-ads/requests/${booking.id}/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` }, body: JSON.stringify({ decision: 'REJECTED', reason: 'Creative text is unreadable.' }) });
    expect(decision.status).toBe(200);
    expect((await decision.json()).data).toMatchObject({ status: 'REJECTED', paymentStatus: 'REFUNDED', rejectionReason: 'Creative text is unreadable.' });
  });
  it('lets admin create a priced slot, blocks double booking, and protects booked slots from deletion', async () => {
    const login = await fetch(`${origin}/api/admin/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'super@arise.test', password: DEMO_PASSWORD }) });
    const adminAuth = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await login.json()).data.accessToken}` };
    const made = await fetch(`${origin}/api/admin/v1/banner-ads/placements`, {
      method: 'POST', headers: adminAuth,
      body: JSON.stringify({ name: 'Home top banner', description: 'Top of home', dailyRatePaise: 250000, mobileWidth: 1080, mobileHeight: 1080 }),
    });
    expect(made.status).toBe(201);
    const slot = (await made.json()).data;
    const dup = await fetch(`${origin}/api/admin/v1/banner-ads/placements`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ ...slot, id: undefined }) });
    expect(dup.status).toBe(422);

    setApiBaseUrl('/api/seller/v1');
    const seller = await signInSeller();
    const token = useSessionStore.getState().accessToken;
    const media = ['mobile'].map((name) => insert('mediaResources', { id: id('MED', 8), sellerId: seller.sellerId, fileName: `${name}.png`, previewUrl: `/media/${name}`, status: 'READY', version: 1 }));
    const book = (key, startsOn, endsOn) => fetch(`${origin}/api/seller/v1/banner-ads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
      body: JSON.stringify({ campaignName: 'Slot test', placementId: slot.id, startsOn, endsOn, destinationType: 'SHOP', destinationValue: seller.sellerId, mobileCreative: { mediaId: media[0].id }, paymentMethod: 'UPI' }),
    });
    const first = await book('slot-a', '2099-02-01', '2099-02-05');
    expect(first.status).toBe(201);
    expect((await first.json()).data.totalPaise).toBe(5 * 250000 * 1.18);
    expect((await book('slot-b', '2099-02-05', '2099-02-07')).status).toBe(409);
    expect((await book('slot-c', '2099-02-06', '2099-02-07')).status).toBe(201);

    const listed = await fetch(`${origin}/api/seller/v1/banner-ads/placements`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await listed.json()).data.find((item) => item.id === slot.id).bookedRanges).toHaveLength(2);

    const del = await fetch(`${origin}/api/admin/v1/banner-ads/placements/${slot.id}`, { method: 'DELETE', headers: adminAuth });
    expect(del.status).toBe(409);
  });
});
