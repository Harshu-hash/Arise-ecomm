// Real-MongoDB test of cashback rules and wallet freeze. Needs TEST_MONGODB_URI to a replica set.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-cashback-')),
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

test('cashback: the best live rule pays once per parcel within its budget', opts, async () => {
  const { createCashbackRule, grantCashback, togglePauseCashbackRule, listCashbackRules } = await import('../src/modules/wallet/application/cashback.service.js');
  const { getBalance } = await import('../src/modules/wallet/public/index.js');
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  const window = { startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + 30 * DAY) };
  const small = await createCashbackRule({ name: '5% back', pct: 5, maxCashbackPaise: 10_000, minOrderPaise: 0, creditExpiryDays: 0, budgetPaise: 0, ...window }, actor);
  await createCashbackRule({ name: '10% over 1000', pct: 10, maxCashbackPaise: 20_000, minOrderPaise: 100_000, creditExpiryDays: 30, budgetPaise: 30_000, ...window }, actor);

  assert.equal(await grantCashback({ userId: 'c1', orderNumber: 'A1', subOrderId: 'p1', valuePaise: 50_000 }), 2_500, 'only the 5% rule fits a smaller order');
  assert.equal(await grantCashback({ userId: 'c1', orderNumber: 'A1', subOrderId: 'p1', valuePaise: 50_000 }), 2_500);
  assert.equal(await getBalance('c1'), 2_500, 'the same parcel is never paid twice');
  assert.equal(await grantCashback({ userId: 'c1', orderNumber: 'A2', subOrderId: 'p2', valuePaise: 200_000 }), 20_000, 'the better rule wins');
  assert.equal(await grantCashback({ userId: 'c1', orderNumber: 'A3', subOrderId: 'p3', valuePaise: 200_000 }), 10_000, 'the 10% rule has only 10,000 of budget left, so the 5% rule (capped) pays instead');
  await togglePauseCashbackRule(small.id, actor);
  assert.equal(await grantCashback({ userId: 'c1', orderNumber: 'A5', subOrderId: 'p5', valuePaise: 50_000 }), 0, 'a paused rule pays nothing');
  assert.equal((await listCashbackRules()).find((rule) => rule.id === small.id).status, 'PAUSED');
});

test('wallet freeze: a frozen wallet cannot spend but still receives credit', opts, async () => {
  const { debitWallet, getBalance, getSpendableBalance } = await import('../src/modules/wallet/public/index.js');
  const { creditWallet } = await import('../src/modules/wallet/application/wallet.service.js');
  const { freezeCustomerWallet } = await import('../src/modules/wallet/application/adminWallet.service.js');
  const { User } = await import('../src/modules/identity/public/index.js');
  const { withTransaction } = await import('../src/config/database.js');
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  const customer = await User.create({ role: 'CUSTOMER', name: 'Freeze Test', email: 'freeze@example.com', status: 'ACTIVE' });
  const id = String(customer._id);
  await creditWallet({ userId: id, type: 'ADJUSTMENT', title: 'seed', amountPaise: 5_000 });
  await freezeCustomerWallet(id, { frozen: true, reason: 'Suspected abuse' }, actor);
  assert.equal(await getSpendableBalance(id), 0);
  await assert.rejects(withTransaction((s) => debitWallet({ userId: id, type: 'ORDER_PAYMENT', title: 'order', amountPaise: 100 }, s)), { code: 'WALLET_FROZEN' });
  await creditWallet({ userId: id, type: 'REFUND', title: 'refund', amountPaise: 700 }); // credits still arrive
  assert.equal(await getBalance(id), 5_700);
  await freezeCustomerWallet(id, { frozen: false, reason: 'Cleared' }, actor);
  assert.equal(await getSpendableBalance(id), 5_700);
});
