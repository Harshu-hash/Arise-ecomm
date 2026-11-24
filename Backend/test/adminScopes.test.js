// Role scopes and maker-checker over HTTP against a real MongoDB (set TEST_MONGODB_URI; wallet writes need a replica set):
// an admin limited to some sellers sees only those, and a wallet adjustment or refund retry over their own limit waits for another admin.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-scopes-')),
});

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };

before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('scopes and approvals: limited sellers, limited money, a second admin decides', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  const { Order } = await import('../src/modules/order/public/index.js');
  const { SellerWallet } = await import('../src/modules/settlement/public/index.js');
  const { Offer } = await import('../src/modules/product/public/index.js');
  const { Review } = await import('../src/modules/review/infrastructure/persistence/review.model.js');
  const { Question } = await import('../src/modules/review/infrastructure/persistence/question.model.js');
  await Promise.all([User.init(), Seller.init(), Order.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/admin/v1`;
  const call = async (user, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken({ sub: String(user._id), role: 'ADMIN' })}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  const [shopA, shopB] = await Promise.all([Seller.create({ storeName: 'Alpha', status: 'ACTIVE' }), Seller.create({ storeName: 'Beta', status: 'ACTIVE' })]);
  const [a, b] = [String(shopA._id), String(shopB._id)];
  const admin = (email, permissions, scope) => User.create({ role: 'ADMIN', email, passwordHash: 'x', status: 'ACTIVE', permissions, scope });
  const MONEY = ['finance.payout.view', 'finance.payout.adjust', 'admin.approval.view'];
  const boss = await admin('boss@arise.test', ['*']);
  const maker = await admin('maker@arise.test', [...MONEY, 'admin.approval.decide', 'sellers.seller.view', 'orders.order.view', 'customers.customer.view', 'reviews.review.view', 'reviews.review.moderate', 'reviews.qa.view', 'dashboard.dashboard.view', 'reports.sales.view'], { sellers: [a], walletAdjustLimit: 10_000 });
  const checker = await admin('checker@arise.test', [...MONEY, 'admin.approval.decide']);
  const noAdjust = await admin('noadjust@arise.test', ['admin.approval.view', 'admin.approval.decide']);
  const viewOnly = await admin('viewonly@arise.test', ['admin.approval.view']);

  // seller scope: the list and the wallet show only the admin's sellers; the rest answer 404
  assert.deepEqual((await call(maker, 'GET', '/sellers')).body.data.map((seller) => seller.id), [a]);
  assert.equal((await call(boss, 'GET', '/sellers')).body.data.length, 2);
  assert.equal((await call(maker, 'GET', `/seller-wallets/${b}`)).status, 404);
  assert.equal((await call(maker, 'GET', `/seller-wallets/${a}`)).status, 200);
  assert.equal((await call(maker, 'POST', `/seller-wallets/${b}/adjustments`, { amountPaise: 100, reason: 'nope' })).status, 404);

  // seller scope on orders: only orders with a parcel from their sellers
  const line = () => ({ _id: new mongoose.Types.ObjectId(), productId: String(new mongoose.Types.ObjectId()), name: 'Mug', imageUrl: 'http://localhost/i.jpg', variantLabel: 'M', quantity: 1 });
  const [custA, custB] = await Promise.all(['a', 'b'].map((n) => User.create({ role: 'CUSTOMER', name: `Cust ${n}`, email: `cust-${n}@arise.test`, passwordHash: 'x', status: 'ACTIVE' })));
  const order = (number, sellerId, customer) => Order.create({
    number, customerId: String(customer._id), checkoutSessionId: new mongoose.Types.ObjectId(), paymentId: new mongoose.Types.ObjectId(), paymentMethod: 'upi',
    address: { city: 'Pune' }, totals: { payablePaise: 1000 }, subOrders: [{ _id: new mongoose.Types.ObjectId(), sellerId, status: 'CONFIRMED', items: [line()], events: [] }],
  });
  const [orderA, orderB] = [await order('ORD-A', a, custA), await order('ORD-B', b, custB)];
  assert.equal((await call(maker, 'GET', '/orders')).body.data.length, 1);
  assert.equal((await call(boss, 'GET', '/orders')).body.data.length, 2);
  assert.equal((await call(maker, 'GET', `/orders/${orderB._id}`)).status, 404);
  assert.equal((await call(maker, 'GET', `/orders/${orderA._id}`)).status, 200);

  // the other lists a seller-limited admin could use to see other sellers' data
  const now = new Date();
  const [pA, pB] = [String(new mongoose.Types.ObjectId()), String(new mongoose.Types.ObjectId())];
  await Offer.collection.insertMany([{ productId: pA, sellerId: a, status: 'LIVE' }, { productId: pB, sellerId: b, status: 'LIVE' }]);
  const reviewDoc = (productId, sellerId, name) => ({
    _id: new mongoose.Types.ObjectId(), orderId: new mongoose.Types.ObjectId(), orderItemId: new mongoose.Types.ObjectId(), customerId: 'c', authorName: name, productId, productName: name, sellerId,
    rating: 5, title: '', body: 'Great product, would buy again.', media: [], status: 'PUBLISHED', autoModeration: 'CLEAN', createdAt: now, updatedAt: now,
  });
  const [revA, revB] = [reviewDoc(pA, a, 'Mug A'), reviewDoc(pB, b, 'Mug B')];
  await Review.collection.insertMany([revA, revB]);
  assert.deepEqual((await call(maker, 'GET', '/reviews')).body.data.map((row) => row.productTitle), ['Mug A']);
  assert.equal((await call(boss, 'GET', '/reviews')).body.data.length, 2);
  assert.equal((await call(maker, 'GET', `/reviews/${revB._id}`)).status, 404);
  assert.equal((await call(maker, 'GET', `/reviews/${revA._id}`)).status, 200);
  assert.equal((await call(maker, 'POST', '/reviews/bulk', { action: 'REJECT', reviewIds: [String(revA._id), String(revB._id)], reason: 'spam' })).status, 404, 'bulk with one review out of scope');

  const questionDoc = (productId, name) => ({ _id: new mongoose.Types.ObjectId(), customerId: 'c', authorName: 'Asha', productId, productName: name, body: 'Does it fit a large mug?', status: 'PUBLISHED', createdAt: now, updatedAt: now });
  const [qA, qB] = [questionDoc(pA, 'Mug A'), questionDoc(pB, 'Mug B')];
  await Question.collection.insertMany([qA, qB]);
  assert.deepEqual((await call(maker, 'GET', '/questions')).body.data.map((row) => row.productTitle), ['Mug A']);
  assert.equal((await call(boss, 'GET', '/questions')).body.data.length, 2);
  assert.equal((await call(maker, 'GET', `/questions/${qB._id}`)).status, 404);

  assert.deepEqual((await call(maker, 'GET', '/customers')).body.data.map((row) => row.id), [String(custA._id)]);
  assert.equal((await call(boss, 'GET', '/customers')).body.data.length, 2);
  assert.equal((await call(maker, 'GET', `/customers/${custB._id}`)).status, 404);
  assert.equal((await call(maker, 'GET', `/customers/${custA._id}`)).status, 200);

  assert.deepEqual((await call(maker, 'GET', '/lookups/customer')).body.data.map((row) => row.value), [String(custA._id)]);
  assert.equal((await call(maker, 'GET', `/lookups/customer?ids=${custB._id}`)).body.data.length, 0, 'asking for an out-of-scope id finds nothing');
  assert.equal((await call(boss, 'GET', '/lookups/customer')).body.data.length, 2);

  // platform-wide numbers are not shown to an admin limited to some sellers
  assert.equal((await call(maker, 'GET', '/dashboard/summary')).status, 403);
  assert.equal((await call(maker, 'GET', '/reports/analytics/sales')).status, 403);
  assert.equal((await call(boss, 'GET', '/dashboard/summary')).status, 200);

  // money limit: within the limit it happens at once; over it, it waits and nothing moves
  const available = async () => (await SellerWallet.findById(a).lean())?.availablePaise ?? 0;
  assert.equal((await call(maker, 'POST', `/seller-wallets/${a}/adjustments`, { amountPaise: 5_000, reason: 'goodwill' })).status, 200);
  assert.equal(await available(), 5_000);
  const over = await call(maker, 'POST', `/seller-wallets/${a}/adjustments`, { amountPaise: 50_000, reason: 'big correction' });
  assert.equal(over.status, 202);
  assert.equal(over.body.data.approvalRequired, true);
  assert.equal(await available(), 5_000, 'nothing moved yet');
  const id = over.body.data.approval.id;

  // who may decide: not the maker, not someone who may not adjust wallets, not someone who can only look
  assert.equal((await call(maker, 'POST', `/approvals/${id}/approve`)).status, 403, 'self-approval');
  assert.equal((await call(noAdjust, 'POST', `/approvals/${id}/approve`)).status, 403, 'must hold the action\'s own permission');
  assert.equal((await call(viewOnly, 'POST', `/approvals/${id}/approve`)).status, 403);
  assert.equal((await call(checker, 'POST', `/approvals/${id}/reject`, {})).status, 422, 'a reason is required to reject');
  assert.equal((await call(viewOnly, 'GET', '/approvals?status=PENDING')).body.data.length, 1);

  // the checker approves: it runs, once, as the maker's action
  const approved = await call(checker, 'POST', `/approvals/${id}/approve`);
  assert.deepEqual([approved.status, approved.body.data.status], [200, 'APPROVED']);
  assert.equal(await available(), 55_000);
  assert.equal((await call(checker, 'POST', `/approvals/${id}/approve`)).status, 409, 'cannot be decided twice');
  assert.equal(await available(), 55_000);

  // rejecting leaves the money alone
  const second = (await call(maker, 'POST', `/seller-wallets/${a}/adjustments`, { amountPaise: -20_000, reason: 'chargeback' })).body.data.approval.id;
  assert.equal((await call(checker, 'POST', `/approvals/${second}/reject`, { reason: 'Not documented' })).body.data.status, 'REJECTED');
  assert.equal(await available(), 55_000);

  // an admin with no limit is not held up
  assert.equal((await call(boss, 'POST', `/seller-wallets/${a}/adjustments`, { amountPaise: 1_000_000, reason: 'bulk' })).status, 200);
});
