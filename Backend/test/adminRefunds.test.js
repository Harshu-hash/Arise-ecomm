// Admin Refunds page: refund entries on payments with their order, the 7-day promise, and retrying a refused one. Needs TEST_MONGODB_URI.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-refunds-')),
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

test('admin refunds: listing, the 7-day promise, filters, and retrying a refused refund', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/public/index.js');
  const { Order } = await import('../src/modules/order/public/index.js');
  const { Payment } = await import('../src/modules/payment/public/index.js');
  const { paymentGateway } = await import('../src/infrastructure/external/payment/index.js');
  await Promise.all([User.init(), Order.init(), Payment.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (token, method, path) => {
    const response = await fetch(`${base}${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  const admin = await User.create({ role: 'ADMIN', email: 'a@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const viewer = await User.create({ role: 'ADMIN', email: 'v@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['finance.refund.view'] });
  const asAdmin = (...args) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), ...args);

  const oid = () => new mongoose.Types.ObjectId();
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
  const paymentFor = async (number, refunds) => {
    const orderId = oid();
    const payment = await Payment.create({ customerId: 'c1', checkoutSessionId: oid(), method: 'upi', amountPaise: 90_000, providerOrderId: `order_${oid()}`, providerPaymentId: `pay_${number}`, status: 'SUCCEEDED', orderId, refunds });
    await Order.create({ _id: orderId, number, customerId: 'c1', checkoutSessionId: payment.checkoutSessionId, paymentId: payment._id, paymentMethod: 'upi', address: { name: 'Asha Rao' }, totals: { payablePaise: 90_000 }, subOrders: [] });
    return payment;
  };
  const done = await paymentFor('ORD-1', [{ key: 'return:6b0000000000000000000001', status: 'SUCCEEDED', amountPaise: 20_000, providerRefundId: 'rfnd_1', initiatedAt: daysAgo(2) }]);
  const refused = await paymentFor('ORD-2', [{ key: 'cancel:abc', status: 'FAILED', amountPaise: 30_000, reason: 'Order cancelled', failureReason: 'Gateway timeout', initiatedAt: daysAgo(9) }]);
  await paymentFor('ORD-3', [{ key: 'rto:def', status: 'PENDING', amountPaise: 10_000, providerRefundId: 'rfnd_3', initiatedAt: daysAgo(1) }]);

  assert.equal((await call(null, 'GET', '/admin/v1/refunds')).status, 401);
  const all = (await asAdmin('GET', '/admin/v1/refunds')).body;
  assert.equal(all.meta.total, 3);
  assert.deepEqual(all.meta.summary, { pendingPaise: 10_000, failedCount: 1, breachedCount: 1 });
  const rowOf = (orderId) => all.data.find((row) => row.orderId === orderId);
  assert.deepEqual([rowOf('ORD-1').type, rowOf('ORD-1').status, rowOf('ORD-1').slaBreached, rowOf('ORD-1').customerName], ['RETURN', 'COMPLETED', false, 'Asha Rao']);
  assert.deepEqual([rowOf('ORD-2').type, rowOf('ORD-2').status, rowOf('ORD-2').failureReason, rowOf('ORD-2').ageDays, rowOf('ORD-2').slaBreached], ['CANCELLATION', 'FAILED', 'Gateway timeout', 9, true]);
  assert.equal(rowOf('ORD-3').status, 'PROCESSING');
  assert.equal(all.data[0].orderId, 'ORD-3', 'newest first');

  assert.equal((await asAdmin('GET', '/admin/v1/refunds?status=FAILED')).body.meta.total, 1);
  assert.equal((await asAdmin('GET', '/admin/v1/refunds?status=PENDING_DETAILS')).body.meta.total, 0, 'a tab that does not exist here is empty');
  assert.equal((await asAdmin('GET', '/admin/v1/refunds?type=RETURN')).body.meta.total, 1);
  assert.equal((await asAdmin('GET', '/admin/v1/refunds?slaBreached=true')).body.meta.total, 1);
  assert.equal((await asAdmin('GET', '/admin/v1/refunds?mode=WALLET')).body.meta.total, 0);
  assert.deepEqual((await asAdmin('GET', '/admin/v1/refunds?q=ord-2')).body.data.map((row) => row.orderId), ['ORD-2']);
  assert.equal((await asAdmin('GET', `/admin/v1/refunds?initiatedAt[lte]=${daysAgo(5).toISOString()}`)).body.meta.total, 1);

  // retry: only a failed one, through the gateway, counted on the order once
  const failedId = `${refused._id}:cancel:abc`;
  assert.equal((await call(signAccessToken({ sub: String(viewer._id), role: 'ADMIN' }), 'POST', `/admin/v1/refunds/${failedId}/retry`)).status, 403);
  assert.equal((await asAdmin('POST', `/admin/v1/refunds/${done._id}:return:6b0000000000000000000001/retry`)).status, 409);
  paymentGateway.refund = async () => ({ providerRefundId: 'rfnd_retry', providerStatus: 'processed' });
  const retried = await asAdmin('POST', `/admin/v1/refunds/${failedId}/retry`);
  assert.deepEqual([retried.status, retried.body.data.status], [200, 'COMPLETED']);
  assert.equal((await Order.findOne({ number: 'ORD-2' })).refundedPaise, 30_000);
  assert.equal((await asAdmin('GET', '/admin/v1/refunds')).body.meta.summary.failedCount, 0);
  assert.equal((await asAdmin('POST', `/admin/v1/refunds/${failedId}/mode`)).status, 409);
  assert.equal((await asAdmin('POST', '/admin/v1/refunds/nonsense:key/retry')).status, 404);
});
