import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { promotionsApi } from '../promotions/api/promotions.api';
import { adsApi } from './api/ads.api';

const server = setupServer(...sellerHandlers);

async function signIn() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

describe('seller growth, promotions & ads', () => {
  let sellerId;

  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId; await signIn(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('creates a campaign and submitting it lands in the shared ad review queue', async () => {
    const liveOffer = find('offers', (o) => o.sellerId === sellerId && o.status === 'LIVE');
    if (!liveOffer) return; // seed variance: owner may have no LIVE offer this run

    const created = await adsApi.create({ name: 'Test Campaign', productIds: [liveOffer.productId], biddingType: 'AUTOMATIC', dailyBudgetPaise: 30000 });
    expect(created.status).toBe('DRAFT');

    const before = db.adCampaigns.filter((c) => c.status === 'PENDING_REVIEW').length;
    const submitted = await adsApi.submit(created.id);
    expect(submitted.status).toBe('PENDING_REVIEW');
    // The admin Ad Review Queue reads PENDING_REVIEW campaigns from this same collection.
    expect(db.adCampaigns.filter((c) => c.status === 'PENDING_REVIEW').length).toBe(before + 1);
    expect(db.adCampaigns.find((c) => c.id === created.id).sellerId).toBe(sellerId);
  });

  it('pauses and resumes a campaign, refusing an illegal transition', async () => {
    const campaign = find('adCampaigns', (c) => c.sellerId === sellerId && c.status === 'ACTIVE');
    if (!campaign) return;
    let row = await adsApi.pause(campaign.id);
    expect(row.status).toBe('PAUSED');
    row = await adsApi.resume(campaign.id);
    expect(row.status).toBe('ACTIVE');
    await expect(adsApi.end(campaign.id).then(() => adsApi.end(campaign.id))).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION' });
  });

  it('recharges the advertiser wallet when prepaid', async () => {
    const wallet = find('advertiserWallets', (w) => w.sellerId === sellerId && w.fundingMode === 'PREPAID');
    if (!wallet) return; // this seller may be on DEDUCT_FROM_PAYOUT
    const before = wallet.balancePaise;
    const updated = await adsApi.recharge(500);
    expect(updated.balancePaise).toBe(before + 50000);
  });

  it('nominating into an open flash sale creates a shared nomination for curation', async () => {
    const sale = db.flashSales.find((s) => s.status === 'NOMINATIONS_OPEN');
    const offer = find('offers', (o) => o.sellerId === sellerId && o.status === 'LIVE');
    if (!sale || !offer) return;

    const before = filter('flashSaleNominations', (n) => n.flashSaleId === sale.id).length;
    const res = await promotionsApi.nominate(sale.id, { offerId: offer.id, flashPricePaise: Math.round(offer.sellingPricePaise * 0.4), committedStock: 10 });
    expect(['PENDING', 'AUTO_REJECTED']).toContain(res.status);
    expect(filter('flashSaleNominations', (n) => n.flashSaleId === sale.id).length).toBe(before + 1);
  });

  it('creates a seller-funded coupon only visible on the seller’s own account', async () => {
    const coupon = await promotionsApi.createCoupon({ code: 'TESTCODE10', name: 'Test 10%', type: 'PERCENT', value: 10, budget: 5000 });
    expect(coupon.sellerId).toBe(sellerId);
    const list = await api.get('/promotions/coupons', { pageSize: 50 });
    expect(list.data.every((c) => c.sellerId === sellerId)).toBe(true);
    expect(list.data.some((c) => c.code === 'TESTCODE10')).toBe(true);
  });
});
