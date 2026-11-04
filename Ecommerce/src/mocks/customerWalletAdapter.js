import { AxiosError } from 'axios';
const LATENCY_MS = 220;
let balancePaise;
let transactions;
const giftCards = new Map([
  ['ARISE-2026-GIFT', { pin: '4829', amountPaise: 50000, redeemed: false }],
]);
const initialTransactions = () => [
  {
    id: 'txn-1',
    direction: 'CREDIT',
    type: 'CASHBACK',
    title: 'Cashback received',
    reference: 'Order ORD-77213',
    amountPaise: 4500,
    status: 'COMPLETED',
    occurredAt: '2026-08-20T08:44:00.000Z',
    balanceAfterPaise: 39100,
  },
  {
    id: 'txn-2',
    direction: 'DEBIT',
    type: 'ORDER_PAYMENT',
    title: 'Paid for order',
    reference: 'Order ORD-65510',
    amountPaise: 29800,
    status: 'COMPLETED',
    occurredAt: '2026-07-02T12:00:00.000Z',
    balanceAfterPaise: 34600,
  },
  {
    id: 'txn-3',
    direction: 'CREDIT',
    type: 'REFERRAL',
    title: 'Referral reward',
    reference: 'Referral reward',
    amountPaise: 10000,
    status: 'COMPLETED',
    occurredAt: '2026-06-08T09:41:00.000Z',
    balanceAfterPaise: 64400,
  },
];
export const resetCustomerWalletFixture = () => {
  balancePaise = 39100;
  transactions = initialTransactions();
  for (const card of giftCards.values()) card.redeemed = false;
};
resetCustomerWalletFixture();
const wallet = () => ({
  currency: 'INR',
  availableBalancePaise: balancePaise,
  pendingBalancePaise: 0,
  expiryBuckets: [{ amountPaise: 10000, expiresAt: '2026-12-31T18:30:00.000Z' }],
  updatedAt: new Date().toISOString(),
});
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
export const customerWalletFixtureAdapter = async config => {
  await wait();
  if (config.url === '/wallet' && config.method === 'get')
    return response(config, { data: wallet() });
  if (config.url === '/wallet/transactions' && config.method === 'get') {
    const offset = Number(config.params?.cursor || 0),
      limit = Math.min(Number(config.params?.limit || 20), 50),
      items = transactions.slice(offset, offset + limit);
    return response(config, {
      data: {
        items,
        total: transactions.length,
        nextCursor: offset + limit < transactions.length ? String(offset + limit) : null,
      },
    });
  }
  if (config.url === '/gift-cards/redeem' && config.method === 'post') {
    const code = config.data?.code?.trim().toUpperCase(),
      pin = config.data?.pin?.trim(),
      card = giftCards.get(code);
    if (!card || card.pin !== pin)
      return reject(config, 422, 'GIFT_CARD_INVALID', 'The gift card code or PIN is invalid.');
    if (card.redeemed)
      return reject(config, 409, 'GIFT_CARD_REDEEMED', 'This gift card has already been redeemed.');
    card.redeemed = true;
    balancePaise += card.amountPaise;
    const transaction = {
      id: `txn-${Date.now()}`,
      direction: 'CREDIT',
      type: 'GIFT_CARD',
      title: 'Gift card redeemed',
      reference: code,
      amountPaise: card.amountPaise,
      status: 'COMPLETED',
      occurredAt: new Date().toISOString(),
      balanceAfterPaise: balancePaise,
    };
    transactions.unshift(transaction);
    return response(config, { data: { transaction, wallet: wallet() } }, 201);
  }
  if (config.url === '/referrals/me' && config.method === 'get')
    return response(config, {
      data: {
        code: 'ARISE-CUS1',
        shareUrl: 'https://arise.example.com/invite/ARISE-CUS1',
        shareMessage:
          'Join Arise with my invite link and unlock the current referral reward after your first eligible order.',
        rewardAmountPaise: 5000,
        successfulReferrals: 2,
        earnedAmountPaise: 10000,
        termsSummary:
          'Rewards are credited after the referred customer completes an eligible order and the return window closes.',
      },
    });
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
