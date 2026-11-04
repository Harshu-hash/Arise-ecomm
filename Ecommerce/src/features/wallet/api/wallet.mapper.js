import {
  giftCardResponseSchema,
  referralResponseSchema,
  transactionsResponseSchema,
  walletResponseSchema,
} from './wallet.schemas';
const money = value => value / 100;
const mapTransaction = item => ({
  ...item,
  type: item.direction === 'CREDIT' ? 'credit' : 'debit',
  subtitle: item.reference || item.type.replace(/_/g, ' '),
  date: new Date(item.occurredAt).toLocaleString('en-IN'),
  amount: money(item.amountPaise),
  balanceAfter: money(item.balanceAfterPaise),
});
export const mapWallet = payload => {
  const data = walletResponseSchema.parse(payload).data;
  return {
    ...data,
    balance: money(data.availableBalancePaise),
    pendingBalance: money(data.pendingBalancePaise),
    expiryBuckets: data.expiryBuckets.map(item => ({ ...item, amount: money(item.amountPaise) })),
  };
};
export const mapTransactions = payload => {
  const data = transactionsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapTransaction) };
};
export const mapGiftCard = payload => {
  const data = giftCardResponseSchema.parse(payload).data;
  return {
    wallet: mapWallet({ data: data.wallet }),
    transaction: mapTransaction(data.transaction),
  };
};
export const mapReferral = payload => {
  const data = referralResponseSchema.parse(payload).data;
  return {
    ...data,
    rewardAmount: money(data.rewardAmountPaise),
    earnedAmount: money(data.earnedAmountPaise),
  };
};
