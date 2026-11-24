// Admin Payments page: every attempt with its order and customer; cash on delivery counts as collected once the parcels are delivered.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-payments-')),
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

test('admin payments: statuses, cash collection, filters, search and sums', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/public/index.js');
  const { Order } = await import('../src/modules/order/public/index.js');
  const { Payment } = await import('../src/modules/payment/public/index.js');
  await Promise.all([User.init(), Order.init(), Payment.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (token, path) => {
    const response = await fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  const admin = await User.create({ role: 'ADMIN', email: 'a@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const limited = await User.create({ role: 'ADMIN', email: 'l@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['dashboard.dashboard.view'] });
  const asAdmin = (path) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), path);

  const oid = () => new mongoose.Types.ObjectId();
  const payment = (extra) => Payment.create({ customerId: 'c1', checkoutSessionId: oid(), method: 'upi', amountPaise: 50_000, providerOrderId: `order_${oid()}`, ...extra });
  const order = (number, deliveredAt, paymentId, paymentMethod) => Order.create({
    number, customerId: 'c1', checkoutSessionId: oid(), paymentId, paymentMethod, address: { name: 'Asha Rao', city: 'Pune' }, totals: { payablePaise: 50_000 },
    subOrders: [{ sellerId: 's1', status: deliveredAt ? 'DELIVERED' : 'CONFIRMED', deliveredAt, items: [] }],
  });

  const paid = await payment({ status: 'SUCCEEDED', providerPaymentId: 'pay_ABC123', refunds: [{ key: 'r1', status: 'SUCCEEDED', amountPaise: 10_000 }, { key: 'r2', status: 'FAILED', amountPaise: 5_000 }] });
  await order('ORD-1', new Date(), paid._id, 'upi');
  await Payment.updateOne({ _id: paid._id }, { $set: { orderId: (await Order.findOne({ number: 'ORD-1' }))._id } });
  await payment({ status: 'FAILED', failureReason: 'Card declined' });
  const codDone = await payment({ method: 'cod', provider: 'COD', status: 'COD_PENDING', amountPaise: 30_000 });
  const codWaiting = await payment({ method: 'cod', provider: 'COD', status: 'COD_PENDING', amountPaise: 20_000 });
  for (const [number, row, deliveredAt] of [['ORD-2', codDone, new Date()], ['ORD-3', codWaiting, null]]) {
    const placed = await order(number, deliveredAt, row._id, 'cod');
    await Payment.updateOne({ _id: row._id }, { $set: { orderId: placed._id } });
  }
  await payment({ method: 'card', status: 'REQUIRES_ACTION' });

  assert.equal((await call(null, '/admin/v1/payments')).status, 401);
  assert.equal((await call(signAccessToken({ sub: String(limited._id), role: 'ADMIN' }), '/admin/v1/payments')).status, 403);

  const all = (await asAdmin('/admin/v1/payments')).body;
  assert.equal(all.meta.total, 5);
  assert.deepEqual(all.meta.summary, { capturedPaise: 50_000 + 30_000, pendingCodPaise: 20_000, failedCount: 1 });
  const byId = new Map(all.data.map((row) => [row.id, row]));
  assert.deepEqual([byId.get(String(paid._id)).status, byId.get(String(paid._id)).refundedPaise, byId.get(String(paid._id)).settledPaise], ['CAPTURED', 10_000, 40_000], 'only successful refunds come off');
  assert.deepEqual([byId.get(String(paid._id)).orderId, byId.get(String(paid._id)).customerName, byId.get(String(paid._id)).txnRef, byId.get(String(paid._id)).gateway, byId.get(String(paid._id)).method], ['ORD-1', 'Asha Rao', 'pay_ABC123', 'Razorpay', 'UPI']);
  assert.equal(byId.get(String(codDone._id)).status, 'CAPTURED', 'delivered cash order: collected');
  assert.equal(byId.get(String(codWaiting._id)).status, 'PENDING');
  assert.equal(byId.get(String(codWaiting._id)).gateway, 'CASH');

  const failed = (await asAdmin('/admin/v1/payments?status=FAILED')).body;
  assert.deepEqual([failed.meta.total, failed.data[0].failureReason, failed.data[0].orderId], [1, 'Card declined', null]);
  assert.equal((await asAdmin('/admin/v1/payments?status=PENDING')).body.meta.total, 2, 'waiting cash and an unfinished card payment');
  assert.equal((await asAdmin('/admin/v1/payments?status=CAPTURED')).body.meta.total, 2);
  assert.equal((await asAdmin('/admin/v1/payments?method=COD')).body.meta.total, 2);
  assert.equal((await asAdmin('/admin/v1/payments?gateway=CASH')).body.meta.total, 2);
  assert.deepEqual((await asAdmin('/admin/v1/payments?q=ORD-3')).body.data.map((row) => row.orderId), ['ORD-3']);
  assert.deepEqual((await asAdmin('/admin/v1/payments?q=pay_abc')).body.data.map((row) => row.id), [String(paid._id)]);
  assert.equal((await asAdmin('/admin/v1/payments?amountPaise[gte]=40000')).body.meta.total, 3);
  assert.equal((await asAdmin('/admin/v1/payments?amountPaise[lte]=25000')).body.meta.total, 1);
  const page = (await asAdmin('/admin/v1/payments?sort=amountPaise&pageSize=2&page=2')).body;
  assert.deepEqual([page.data.length, page.meta.totalPages, page.data[0].amountPaise], [2, 3, 50_000]);
});
