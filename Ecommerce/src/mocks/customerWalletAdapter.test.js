import { customerWalletFixtureAdapter, resetCustomerWalletFixture } from './customerWalletAdapter';
describe('customerWalletFixtureAdapter', () => {
  beforeEach(resetCustomerWalletFixture);
  it('returns a ledger-backed wallet and paginated transactions', async () => {
    const wallet = await customerWalletFixtureAdapter({ url: '/wallet', method: 'get' }),
      ledger = await customerWalletFixtureAdapter({
        url: '/wallet/transactions',
        method: 'get',
        params: { limit: 2 },
      });
    expect(wallet.data.data.availableBalancePaise).toBe(39100);
    expect(ledger.data.data).toMatchObject({ items: expect.any(Array), total: 3, nextCursor: '2' });
  });
  it('redeems a gift card exactly once and creates a ledger entry', async () => {
    const result = await customerWalletFixtureAdapter({
      url: '/gift-cards/redeem',
      method: 'post',
      data: { code: 'ARISE-2026-GIFT', pin: '4829' },
    });
    expect(result.data.data).toMatchObject({
      wallet: { availableBalancePaise: 89100 },
      transaction: { type: 'GIFT_CARD', amountPaise: 50000 },
    });
    await expect(
      customerWalletFixtureAdapter({
        url: '/gift-cards/redeem',
        method: 'post',
        data: { code: 'ARISE-2026-GIFT', pin: '4829' },
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it('returns server-generated referral terms and share links', async () => {
    const response = await customerWalletFixtureAdapter({ url: '/referrals/me', method: 'get' });
    expect(response.data.data).toMatchObject({
      code: 'ARISE-CUS1',
      shareUrl: expect.stringContaining('/invite/'),
      earnedAmountPaise: 10000,
    });
  });
  it('rejects invalid gift cards without changing balance', async () => {
    await expect(
      customerWalletFixtureAdapter({
        url: '/gift-cards/redeem',
        method: 'post',
        data: { code: 'BAD', pin: '0000' },
      }),
    ).rejects.toMatchObject({ response: { status: 422 } });
    const wallet = await customerWalletFixtureAdapter({ url: '/wallet', method: 'get' });
    expect(wallet.data.data.availableBalancePaise).toBe(39100);
  });
});
