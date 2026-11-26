// Real-MongoDB test of paying part of an order with store credit: quote, charge, debit, and the split refund on cancel.
// Needs TEST_MONGODB_URI to a replica set. Razorpay and Shiprocket are stubbed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-walletco-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };

before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('wallet checkout: credit pays part of an online order, is taken once, and a cancel refunds card then wallet', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { paymentGateway } = await import('../src/infrastructure/external/payment/index.js');
  const { shippingGateway } = await import('../src/infrastructure/external/shipping/index.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { AddressBook } = await import('../src/modules/customer/infrastructure/persistence/addressBook.model.js');
  const { Order } = await import('../src/modules/order/infrastructure/persistence/order.model.js');
  const { Payment } = await import('../src/modules/payment/infrastructure/persistence/payment.model.js');
  const { creditWallet, getBalance } = await import('../src/modules/wallet/public/index.js');
  const { catalogChanged } = await import('../src/infrastructure/realtime/catalogEvents.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init(), Seller.init(), Order.init(), Payment.init()]);

  const refunds = [];
  paymentGateway.createPayment = async ({ receipt }) => ({ providerOrderId: `order_${receipt}` });
  paymentGateway.verifyCheckout = ({ signature }) => signature === 'good';
  paymentGateway.refund = async ({ amountPaise }) => { refunds.push(amountPaise); return { providerRefundId: `rfnd_${refunds.length}`, providerStatus: 'processed' }; };
  shippingGateway.quote = async () => ({ serviceable: true, feePaise: 5_000, etaDays: 3 });

  const rootId = new mongoose.Types.ObjectId();
  await Category.create({ _id: rootId, name: 'Wal Root', nameKey: 'wal root', slug: 'wal-root', parentId: null, rootId, level: 1, sortOrder: 1, gstRate: 12, hsnCode: '6109', commissionPct: 10 });
  const created = await Seller.create({ storeName: 'Wal A', status: 'APPROVED', location: { pincode: '380015', address: '1 Warehouse Road', city: 'Ahmedabad', state: 'Gujarat' } });
  await User.create({ role: 'SELLER', sellerId: String(created._id), email: 'owner@wal.test', phone: '9800000010', name: 'Owner' });
  const product = await Product.create({ title: 'Wal Mug', status: 'LIVE', categoryId: rootId, rootCategoryId: rootId, categoryPath: 'Wal Root', brandName: 'Acme', images: ['public/products/s1/o.png'], createdBySellerId: String(created._id) });
  const variant = await Variant.create({ productId: product._id, sku: 'WAL-MUG', label: 'One', weightG: 400, dimsCm: { l: 1, w: 1, h: 1 } });
  const offer = String((await Offer.create({ productId: product._id, variantId: variant._id, sellerId: String(created._id), sellingPricePaise: 20_000, mrpPaise: 22_000, stock: 5, status: 'LIVE' }))._id);
  catalogChanged();
  const alice = String(new mongoose.Types.ObjectId());
  await User.create({ _id: alice, role: 'CUSTOMER', email: 'alice@wal.test', name: 'Alice Rao' });
  await AddressBook.create({ customerId: alice, addresses: [{ label: 'Home', isDefault: true, name: 'Alice Rao', phone: '9876543210', line: '12 Test Street', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' }] });

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  let keys = 0;
  const call = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'idempotency-key': `wk-${++keys}-${Date.now()}`, authorization: `Bearer ${signAccessToken({ sub: alice, role: 'CUSTOMER' })}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  await creditWallet({ userId: alice, type: 'REFERRAL', title: 'Welcome reward', amountPaise: 8_000 });
  assert.equal((await call('GET', '/wallet')).body.data.availableBalancePaise, 8_000);
  assert.equal((await call('POST', '/cart/items', { offerId: offer, quantity: 1 })).status, 201);
  const session = (await call('POST', '/checkout/sessions', { source: 'CART' })).body.data;
  const full = 20_000 + 5_000 + 500; // item + delivery + platform fee
  assert.deepEqual([session.totals.payablePaise, session.totals.walletCreditPaise, session.walletBalancePaise, session.useWallet], [full, 0, 8_000, false]);

  const withWallet = (await call('PUT', `/checkout/sessions/${session.id}/wallet`, { use: true })).body.data;
  assert.equal(withWallet.totals.walletCreditPaise, 8_000, 'under the 50% cap, so the whole balance is used');
  assert.equal(withWallet.totals.payablePaise, full - 8_000);
  assert.equal((await call('PATCH', `/checkout/sessions/${session.id}/payment-method`, { paymentMethod: 'cod' })).body.data.totals.walletCreditPaise, 0, 'cash on delivery never uses store credit');
  assert.equal((await call('PATCH', `/checkout/sessions/${session.id}/payment-method`, { paymentMethod: 'upi' })).body.data.totals.walletCreditPaise, 8_000);

  const intent = (await call('POST', `/checkout/sessions/${session.id}/payment-intent`, { method: 'upi' })).body.data;
  assert.equal((await Payment.findById(intent.id)).amountPaise, full - 8_000, 'the card is asked for only what is left');
  assert.equal(await getBalance(alice), 8_000, 'nothing is taken from the wallet until the order is placed');
  const payment = await Payment.findById(intent.id);
  await call('POST', `/payments/${intent.id}/confirm`, { razorpayPaymentId: 'pay_w1', razorpayOrderId: payment.providerOrderId, razorpaySignature: 'good' });
  const placed = await call('POST', '/orders', { checkoutSessionId: session.id, paymentId: intent.id });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  assert.equal(await getBalance(alice), 0);
  assert.equal((await Payment.findById(intent.id)).walletCreditPaise, 8_000);
  const again = await call('POST', '/orders', { checkoutSessionId: session.id, paymentId: intent.id }); // a retry: no second debit
  assert.equal(again.status, 201);
  assert.equal(await getBalance(alice), 0);
  const entries = (await call('GET', '/wallet/transactions')).body.data;
  assert.deepEqual(entries.items.map((entry) => [entry.direction, entry.type, entry.amountPaise]), [['DEBIT', 'ORDER_PAYMENT', 8_000], ['CREDIT', 'REFERRAL', 8_000]]);

  const cancelled = await call('POST', `/orders/${placed.body.data.id}/cancel`, { reason: 'changed my mind' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  // everything is refunded (all parcels cancelled): the card gets back what it paid, and the wallet gets back its share
  assert.deepEqual(refunds, [full - 8_000]);
  assert.equal(await getBalance(alice), 8_000);
});
