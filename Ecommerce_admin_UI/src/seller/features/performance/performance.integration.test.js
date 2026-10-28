import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find, findById, id, insert } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { performanceApi } from './api/performance.api';

const server = setupServer(...sellerHandlers);

async function signIn() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

describe('seller performance & account health', () => {
  let sellerId;

  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId; await signIn(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('returns a health summary derived from the seller’s own metrics', async () => {
    const health = await performanceApi.health();
    expect(health).toHaveProperty('score');
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(['EXCELLENT', 'GOOD', 'AT_RISK', 'CRITICAL']).toContain(health.tier);
    expect(health.metrics.length).toBe(4);
  });

  it('returns an 8-point weekly trend', async () => {
    const trend = await performanceApi.trend();
    expect(trend).toHaveLength(8);
    expect(trend[0]).toHaveProperty('cancellationPct');
  });

  it('disputing an applied penalty moves it to DISPUTED, and a second dispute is refused', async () => {
    const seller = findById('sellers', sellerId);
    const penalty = insert('penalties', {
      id: id('PEN', 6), sellerId, sellerName: seller.storeName, violationCode: 'LATE_DISPATCH',
      violationLabel: 'Dispatched after the promised date', orderId: 'ORD-TEST1', amountPaise: 10000,
      status: 'APPLIED', appliedAt: mockNowIso(), evidence: 'test', disputeReason: null, waivedByName: null, waivedReason: null, version: 1,
    });

    const list = await api.get('/penalties', { pageSize: 50 });
    expect(list.data.every((p) => p.sellerId === sellerId)).toBe(true);
    expect(list.data.some((p) => p.id === penalty.id)).toBe(true);

    const disputed = await performanceApi.disputePenalty(penalty.id, 'The customer cancelled, not me.');
    expect(disputed.status).toBe('DISPUTED');

    await expect(performanceApi.disputePenalty(penalty.id, 'again')).rejects.toMatchObject({ code: 'DISPUTE_INVALID' });
  });

  it('cannot dispute, or even see, another seller’s penalty', async () => {
    const otherSeller = db.sellers.find((s) => s.status === 'ACTIVE' && s.id !== sellerId);
    const foreign = insert('penalties', {
      id: id('PEN', 6), sellerId: otherSeller.id, sellerName: otherSeller.storeName, violationCode: 'LATE_DISPATCH',
      violationLabel: 'x', orderId: 'ORD-X', amountPaise: 5000, status: 'APPLIED', appliedAt: mockNowIso(),
      evidence: 'x', disputeReason: null, waivedByName: null, waivedReason: null, version: 1,
    });
    await expect(performanceApi.disputePenalty(foreign.id, 'not mine')).rejects.toMatchObject({ status: 404 });
    const list = await api.get('/penalties', { pageSize: 200 });
    expect(list.data.some((p) => p.id === foreign.id)).toBe(false);
  });

  it('files a claim that lands in the shared seller-claims queue', async () => {
    const before = filter('sellerClaims', (c) => c.sellerId === sellerId).length;
    const claim = await performanceApi.createClaim({ type: 'LOST_IN_TRANSIT', orderId: 'ORD-99999', amountClaimed: 1200, evidence: 'Tracking stalled for 10 days.' });
    expect(claim.status).toBe('SUBMITTED');
    expect(claim.sellerId).toBe(sellerId);
    expect(filter('sellerClaims', (c) => c.sellerId === sellerId).length).toBe(before + 1);
  });
});
