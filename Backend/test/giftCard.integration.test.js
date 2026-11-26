// Real-MongoDB test of gift cards and the admin's manual wallet adjustments.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-giftcard-')),
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

test('gift cards: generated with a PIN, redeemed once into the wallet, and expired or blocked cards are refused', opts, async () => {
  const { generateGiftCards, redeemGiftCard, blockGiftCard, listGiftCards } = await import('../src/modules/wallet/application/giftCard.service.js');
  const { GiftCard } = await import('../src/modules/wallet/infrastructure/persistence/giftCard.model.js');
  const { getBalance } = await import('../src/modules/wallet/public/index.js');
  await GiftCard.init();
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  const [a, b, c] = await generateGiftCards({ count: 3, amountPaise: 50_000, expiresAt: new Date(Date.now() + 30 * DAY), note: 'launch' }, actor);
  assert.match(a.code, /^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await GiftCard.findOne({ code: a.code })).pinHash.includes(a.pin), false, 'only a hash of the PIN is stored');

  await assert.rejects(redeemGiftCard('u1', { code: a.code, pin: a.pin === '0000' ? '1111' : '0000' }), { code: 'GIFT_CARD_INVALID' });
  await assert.rejects(redeemGiftCard('u1', { code: 'GC-NOPE', pin: '1234' }), { code: 'GIFT_CARD_INVALID' });
  const result = await redeemGiftCard('u1', { code: a.code.toLowerCase(), pin: a.pin });
  assert.deepEqual([result.wallet.availableBalancePaise, result.transaction.type, result.transaction.amountPaise], [50_000, 'GIFT_CARD', 50_000]);
  await assert.rejects(redeemGiftCard('u2', { code: a.code, pin: a.pin }), { code: 'GIFT_CARD_REDEEMED' });
  assert.equal(await getBalance('u2'), 0);

  await GiftCard.updateOne({ code: b.code }, { $set: { expiresAt: new Date(Date.now() - DAY) } });
  await assert.rejects(redeemGiftCard('u1', { code: b.code, pin: b.pin }), { code: 'GIFT_CARD_EXPIRED' });
  const listed = await listGiftCards({});
  await blockGiftCard(listed.items.find((card) => card.code === c.code).id, actor);
  await assert.rejects(redeemGiftCard('u1', { code: c.code, pin: c.pin }), { code: 'GIFT_CARD_INVALID' });
  await assert.rejects(blockGiftCard(listed.items.find((card) => card.code === a.code).id, actor), { code: 'ILLEGAL_TRANSITION' });
  assert.equal(await getBalance('u1'), 50_000);
});

test('admin wallet: manual credit and debit are audited, and a debit cannot overdraw', opts, async () => {
  const { User } = await import('../src/modules/identity/public/index.js');
  const { adjustCustomerWallet, adminWalletView } = await import('../src/modules/wallet/application/adminWallet.service.js');
  const actor = { userId: 'admin-1', role: 'ADMIN' };
  const customer = await User.create({ role: 'CUSTOMER', name: 'Wallet Test', email: 'wt@example.com', status: 'ACTIVE' });
  const id = String(customer._id);
  assert.equal((await adjustCustomerWallet(id, { amountPaise: 30_000, reason: 'Goodwill for a late order' }, actor)).balancePaise, 30_000);
  assert.equal((await adjustCustomerWallet(id, { amountPaise: -10_000, reason: 'Reversal of a mistaken credit' }, actor)).balancePaise, 20_000);
  await assert.rejects(adjustCustomerWallet(id, { amountPaise: -20_001, reason: 'too much' }, actor), { code: 'WALLET_INSUFFICIENT' });
  await assert.rejects(adjustCustomerWallet(String(new mongoose.Types.ObjectId()), { amountPaise: 100, reason: 'nobody' }, actor), { code: 'NOT_FOUND' });
  const view = await adminWalletView(id);
  assert.deepEqual(view.items.map((entry) => [entry.direction, entry.type, entry.amountPaise, entry.reference]), [['DEBIT', 'ADJUSTMENT', 10_000, 'Reversal of a mistaken credit'], ['CREDIT', 'ADJUSTMENT', 30_000, 'Goodwill for a late order']]);
});
