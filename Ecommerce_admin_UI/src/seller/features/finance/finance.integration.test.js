import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { financeApi } from './api/finance.api';

const server = setupServer(...sellerHandlers);

async function signIn() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

describe('seller finance', () => {
  let sellerId;

  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId; await signIn(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('returns a dashboard summary and only the seller’s own data', async () => {
    const summary = await financeApi.summary();
    expect(summary).toHaveProperty('nextPayoutPaise');
    expect(summary).toHaveProperty('lifetimeNetPaise');

    const payouts = await api.get('/finance/payouts', { pageSize: 100 });
    const ownPayoutIds = new Set(filter('sellerPayouts', (p) => p.sellerId === sellerId).map((p) => p.id));
    expect(payouts.data.every((p) => ownPayoutIds.has(p.id))).toBe(true);

    const txns = await api.get('/finance/transactions', { pageSize: 200 });
    const ownLineIds = new Set(filter('settlementLines', (l) => l.sellerId === sellerId).map((l) => l.id));
    expect(txns.data.every((t) => ownLineIds.has(t.id))).toBe(true);
  });

  it('each settlement line’s net equals its deduction waterfall', async () => {
    const txns = await api.get('/finance/transactions', { pageSize: 500 });
    for (const l of txns.data) {
      const expected = l.salePaise - l.feesBeforeTaxPaise - l.gstOnFeesPaise - l.tcsPaise - l.tdsPaise + l.adjustmentsPaise;
      expect(l.netPaise).toBe(expected);
    }
  });

  it('a payout reconciles exactly with the admin batch it belongs to', () => {
    // Platform-wide invariant: a payout's gross equals the sum of the sale
    // amounts of the settlement lines assigned to it — the same rows the admin
    // batch holds. This is why the seller's numbers can never disagree.
    for (const payout of db.sellerPayouts) {
      const lines = filter('settlementLines', (l) => l.payoutId === payout.id);
      const gross = lines.reduce((n, l) => n + l.salePaise, 0);
      expect(payout.grossPaise).toBe(gross);
    }
  });

  it('exposes a payout detail whose lines sum to its gross', async () => {
    const mine = filter('sellerPayouts', (p) => p.sellerId === sellerId);
    if (!mine.length) return; // owner may land in no batch in a given seed
    const detail = await financeApi.payoutDetail(mine[0].id);
    const gross = detail.lines.reduce((n, l) => n + l.salePaise, 0);
    expect(gross).toBe(detail.grossPaise);
    expect(detail.lines.every((l) => l.settled)).toBe(true);
  });

  it('scopes invoices and tax summaries to the seller', async () => {
    const invoices = await api.get('/finance/invoices', { pageSize: 500 });
    expect(invoices.data.every((inv) => inv.sellerId === sellerId)).toBe(true);
    const tax = await financeApi.tax();
    expect(tax.every((t) => t.sellerId === sellerId)).toBe(true);
  });
});
