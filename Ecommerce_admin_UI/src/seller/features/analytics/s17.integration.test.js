import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { exportJobsApi } from '@core/api/foundationApi';
import { db, find, update } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { analyticsApi } from './api/analytics.api';

const server = setupServer(...handlers, ...sellerHandlers);

describe('S17 analytics, growth and durable reports', () => {
  let sellerId;
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (row) => row.email === 'owner@arise.test').sellerId; await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('uses one exact range and timezone across every analytics view', async () => {
    const params = { from: '2026-09-10', to: '2026-09-20', timezone: 'Asia/Kolkata', compare: true };
    const views = await Promise.all(['overview', 'products', 'traffic', 'operations', 'finance'].map((view) => analyticsApi.view(view, params)));
    expect(views.map((view) => view.period)).toEqual(Array(5).fill({ ...params, compare: true }));
    expect(views[0].series.every((point) => point.date >= params.from && point.date <= params.to)).toBe(true);
  });

  it('drills a product funnel row into the seller-owned listing remediation screen', async () => {
    const products = await analyticsApi.view('products', { from: '2026-08-01', to: '2026-12-31' });
    const row = products.rows.find((item) => item.productViews > 0) ?? products.rows[0];
    expect(row.remediationPath).toBe(`/listings/${row.listingId}`);
    expect(db.offers.find((offer) => offer.id === row.listingId)).toMatchObject({ sellerId });
  });

  it('reconciles billed ad spend to the billing ledger and publishes attribution semantics', async () => {
    const billing = (await api.get('/ads/billing')).data;
    expect(billing.billedSpendPaise).toBe(billing.ledgerSpendPaise);
    expect(billing).toMatchObject({ variancePaise: 0, reconciled: true });
    expect(billing.attributionDefinition).toMatch(/attributed revenue/i);
    const traffic = await analyticsApi.view('traffic', { from: '2026-01-01', to: '2026-12-31' });
    expect(traffic.definitions.attributedRevenue).toMatch(/ad click/i);
  });

  it('keeps an asynchronous report job after reload and completes it with an artifact', async () => {
    const created = await exportJobsApi.create({ resource: 'orders', format: 'CSV', filters: { from: '2026-09-01', to: '2026-09-30' }, estimatedRows: 100, idempotencyKey: 's17-durable-report' });
    expect(created.status).toBe('PROCESSING');
    update('jobs', created.id, { startedAtMs: 0, durationMs: 1 });
    useSessionStore.getState().setAnonymous();
    await signInSeller();
    const jobs = await exportJobsApi.list();
    expect(jobs.find((job) => job.id === created.id)).toMatchObject({ status: 'COMPLETED' });
    expect(jobs.find((job) => job.id === created.id).resultUrl).toContain('/mock-downloads/orders');
  });

  it('audits a recommendation action and immediately reflects its state', async () => {
    const recommendation = (await analyticsApi.recommendations()).find((row) => row.status === 'OPEN');
    const applied = await analyticsApi.actOnRecommendation(recommendation.id, 'apply', { outcome: 'Stock replenishment started.' });
    expect(applied).toMatchObject({ status: 'APPLIED', outcome: 'Stock replenishment started.' });
    expect((await analyticsApi.recommendations()).find((row) => row.id === recommendation.id).status).toBe('APPLIED');
    expect(db.auditEvents.find((event) => event.entityId === recommendation.id)).toMatchObject({ action: 'recommendation.apply', actorId: expect.any(String) });
  });
});
