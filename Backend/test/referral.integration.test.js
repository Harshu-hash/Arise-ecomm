// Real-MongoDB test of store credit and Refer & Earn: wallet lots, referral qualification and payout, wallet-aware refunds.
// Needs TEST_MONGODB_URI to a replica set (wallet debits run in a transaction).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-referral-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };
const DAY = 86_400_000;

before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('wallet: spends the earliest-expiring credit first, never overdraws, and posts a key once', opts, async () => {
  const { creditWallet, debitWallet, getBalance } = await import('../src/modules/wallet/public/index.js');
  const { getWalletSummary, listWalletTransactions } = await import('../src/modules/wallet/application/wallet.service.js');
  const { WalletEntry } = await import('../src/modules/wallet/infrastructure/persistence/walletEntry.model.js');
  const { withTransaction } = await import('../src/config/database.js');
  await WalletEntry.init();
  const userId = 'wallet-user';
  const later = await creditWallet({ userId, type: 'REFERRAL', title: 'later', amountPaise: 500, expiresAt: new Date(Date.now() + 10 * DAY) });
  await creditWallet({ userId, type: 'REFUND', title: 'never expires', amountPaise: 300 });
  await creditWallet({ userId, type: 'REFERRAL', title: 'sooner', amountPaise: 200, expiresAt: new Date(Date.now() + 5 * DAY) });
  await creditWallet({ userId, type: 'REFERRAL', title: 'already lapsed', amountPaise: 999, expiresAt: new Date(Date.now() - DAY) });
  assert.equal(await getBalance(userId), 1000);

  await withTransaction((s) => debitWallet({ userId, type: 'ORDER_PAYMENT', title: 'order', amountPaise: 600, key: 'order:1' }, s));
  assert.equal(await getBalance(userId), 400);
  assert.equal((await WalletEntry.findById(later._id)).remainingPaise, 100, 'the 5-day lot went first, then 400 of the 10-day lot');

  await withTransaction((s) => debitWallet({ userId, type: 'ORDER_PAYMENT', title: 'order', amountPaise: 600, key: 'order:1' }, s)); // same key: no second charge
  assert.equal(await getBalance(userId), 400);
  await assert.rejects(withTransaction((s) => debitWallet({ userId, type: 'ORDER_PAYMENT', title: 'too much', amountPaise: 401 }, s)), { code: 'WALLET_INSUFFICIENT' });
  assert.equal(await getBalance(userId), 400, 'a failed debit leaves the balance alone');

  const first = await creditWallet({ userId, type: 'REFERRAL', title: 'once', amountPaise: 50, key: 'k1' });
  const again = await creditWallet({ userId, type: 'REFERRAL', title: 'once', amountPaise: 50, key: 'k1' });
  assert.equal(String(first._id), String(again._id));
  const summary = await getWalletSummary(userId);
  assert.equal(summary.availableBalancePaise, 450);
  assert.equal(summary.expiryBuckets.length, 1);
  assert.equal((await listWalletTransactions(userId)).total, 6);
});

test('referral: qualifies on the friend\'s first big-enough delivered order, pays both once, and honours manual approval', opts, async () => {
  const { User } = await import('../src/modules/identity/public/index.js');
  const { updateSettingsSection } = await import('../src/modules/admin/public/index.js');
  const { getOrCreateCode, checkSignupCode, attachReferral, qualifyOnDelivered, getMyReferral, decideReferral } = await import('../src/modules/referral/application/referral.service.js');
  const { Referral } = await import('../src/modules/referral/infrastructure/persistence/referral.models.js');
  const { getBalance } = await import('../src/modules/wallet/public/index.js');
  await Promise.all([Referral.init(), User.init()]);
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  const settings = (values) => updateSettingsSection('referral', { values }, actor);
  const customer = (name) => User.create({ role: 'CUSTOMER', name, email: `${name}@example.com`, status: 'ACTIVE' });
  const order = (customerId, subtotalPaise) => ({ _id: new mongoose.Types.ObjectId(), customerId: String(customerId), totals: { subtotalPaise, couponDiscountPaise: 0 } });

  const asha = await customer('asha');
  const ravi = await customer('ravi');
  const code = await getOrCreateCode(asha._id);
  assert.equal(await getOrCreateCode(asha._id), code, 'one stable code per customer');
  assert.equal(await checkSignupCode(code.toLowerCase()), null, 'program off: the code is ignored, signup is not blocked');

  await settings({ enabled: true, referrerRewardPaise: 10_000, refereeRewardPaise: 5_000, minOrderPaise: 50_000, rewardExpiryDays: 30, maxRewardsPerReferrer: 1, autoApprove: true });
  assert.equal(await checkSignupCode(code.toLowerCase()), code);
  await assert.rejects(checkSignupCode('NOPE'), { code: 'VALIDATION_ERROR' });
  assert.equal(await attachReferral({ code, refereeId: asha._id }), null, 'cannot refer yourself');
  assert.ok(await attachReferral({ code, refereeId: ravi._id }));
  assert.equal(await attachReferral({ code, refereeId: ravi._id }), null, 'a customer is invited once');

  await qualifyOnDelivered(order(ravi._id, 49_999)); // below the minimum: still waiting
  assert.equal((await Referral.findOne({ refereeId: String(ravi._id) })).status, 'PENDING');
  const big = order(ravi._id, 120_000);
  await qualifyOnDelivered(big);
  await qualifyOnDelivered(big); // delivered twice (retry): paid once
  assert.equal((await Referral.findOne({ refereeId: String(ravi._id) })).status, 'REWARDED');
  assert.equal(await getBalance(asha._id), 10_000);
  assert.equal(await getBalance(ravi._id), 5_000);
  const mine = await getMyReferral(asha._id);
  assert.deepEqual([mine.successfulReferrals, mine.earnedAmountPaise, mine.referrals[0].friendName], [1, 10_000, 'ravi']);

  // the referrer's reward limit is 1: the next friend is rejected, not paid
  const meera = await customer('meera');
  await attachReferral({ code, refereeId: meera._id });
  await qualifyOnDelivered(order(meera._id, 120_000));
  const capped = await Referral.findOne({ refereeId: String(meera._id) });
  assert.equal(capped.status, 'REJECTED');

  // manual approval: qualified, nothing paid until an admin decides
  await settings({ maxRewardsPerReferrer: 0, autoApprove: false });
  const kiran = await customer('kiran');
  await attachReferral({ code, refereeId: kiran._id });
  await qualifyOnDelivered(order(kiran._id, 120_000));
  const waiting = await Referral.findOne({ refereeId: String(kiran._id) });
  assert.equal(waiting.status, 'QUALIFIED');
  assert.equal(await getBalance(kiran._id), 0);
  await assert.rejects(decideReferral(waiting._id, { decision: 'REJECT' }, actor).then(() => decideReferral(waiting._id, { decision: 'APPROVE' }, actor)), { code: 'ILLEGAL_TRANSITION' });
});

test('refunds: an order part-paid with store credit refunds the card first, then the wallet, never more than was paid', opts, async () => {
  const { Payment } = await import('../src/modules/payment/infrastructure/persistence/payment.model.js');
  const { refundPayment } = await import('../src/modules/payment/public/index.js');
  const { paymentGateway } = await import('../src/infrastructure/external/payment/index.js');
  const { getBalance } = await import('../src/modules/wallet/public/index.js');
  const sent = [];
  paymentGateway.refund = async ({ amountPaise }) => { sent.push(amountPaise); return { providerRefundId: `rfnd_${sent.length}`, providerStatus: 'processed' }; };
  const payment = await Payment.create({ customerId: 'refund-user', checkoutSessionId: new mongoose.Types.ObjectId(), method: 'upi', status: 'SUCCEEDED', amountPaise: 600, walletCreditPaise: 400, providerOrderId: 'order_x', providerPaymentId: 'pay_x' });

  await refundPayment(payment._id, { key: 'a', amountPaise: 700, reason: 'cancel' });
  assert.deepEqual(sent, [600]);
  assert.equal(await getBalance('refund-user'), 100);
  await refundPayment(payment._id, { key: 'a', amountPaise: 700, reason: 'cancel' }); // same key: nothing more
  assert.deepEqual(sent, [600]);
  await refundPayment(payment._id, { key: 'b', amountPaise: 300, reason: 'cancel' });
  assert.deepEqual(sent, [600], 'the card is fully refunded: the rest goes to the wallet only');
  assert.equal(await getBalance('refund-user'), 400);
  await assert.rejects(refundPayment(payment._id, { key: 'c', amountPaise: 1, reason: 'too much' }), { code: 'REFUND_TOO_LARGE' });
});
