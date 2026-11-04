import { mapGiftCard, mapReferral, mapTransactions, mapWallet } from './wallet.mapper';
const wallet = {
  currency: 'INR',
  availableBalancePaise: 39100,
  pendingBalancePaise: 0,
  expiryBuckets: [{ amountPaise: 10000, expiresAt: '2026-12-31T18:30:00.000Z' }],
  updatedAt: '2026-08-01T00:00:00.000Z',
};
const transaction = {
  id: 'txn-1',
  direction: 'CREDIT',
  type: 'CASHBACK',
  title: 'Cashback',
  reference: 'Order 1',
  amountPaise: 4500,
  status: 'COMPLETED',
  occurredAt: '2026-08-01T00:00:00.000Z',
  balanceAfterPaise: 39100,
};
describe('wallet mappers', () => {
  it('maps ledger money from paise', () => {
    expect(mapWallet({ data: wallet })).toMatchObject({
      balance: 391,
      expiryBuckets: [{ amount: 100 }],
    });
    expect(
      mapTransactions({ data: { items: [transaction], total: 1, nextCursor: null } }).items[0],
    ).toMatchObject({ amount: 45, type: 'credit', balanceAfter: 391 });
  });
  it('maps gift card ledger results', () => {
    expect(mapGiftCard({ data: { wallet, transaction } })).toMatchObject({
      wallet: { balance: 391 },
      transaction: { amount: 45 },
    });
  });
  it('maps referral amounts and server links', () => {
    expect(
      mapReferral({
        data: {
          code: 'CODE',
          shareUrl: 'https://example.com/invite/CODE',
          shareMessage: 'Join with this link.',
          rewardAmountPaise: 5000,
          successfulReferrals: 2,
          earnedAmountPaise: 10000,
          termsSummary: 'After an eligible order.',
        },
      }),
    ).toMatchObject({ rewardAmount: 50, earnedAmount: 100 });
  });
  it('rejects negative balances', () => {
    expect(() => mapWallet({ data: { ...wallet, availableBalancePaise: -1 } })).toThrow();
  });
});
