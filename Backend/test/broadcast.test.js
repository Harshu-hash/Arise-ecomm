// Push broadcasts: an admin sends or schedules a message to customers and/or sellers; it lands in their notification list and,
// for customers with a registered phone, goes out through Firebase. Needs TEST_MONGODB_URI.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-broadcast-')),
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

test('push broadcasts: validate, send to customers and sellers, respect opt-outs and platforms, schedule, cancel', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  const { Device } = await import('../src/modules/notification/infrastructure/persistence/device.model.js');
  const { Notification } = await import('../src/modules/notification/infrastructure/persistence/notification.model.js');
  const { Preference } = await import('../src/modules/notification/infrastructure/persistence/preference.model.js');
  const { PushBroadcast } = await import('../src/modules/notification/infrastructure/persistence/pushBroadcast.model.js');
  const { dispatchDueBroadcasts } = await import('../src/modules/notification/public/index.js');
  const { fcm } = await import('../src/infrastructure/external/notification/fcm.js');
  await Promise.all([User.init(), Seller.init(), Device.init(), Notification.init(), PushBroadcast.init()]);

  const pushes = [];
  fcm.configured = () => true;
  fcm.send = async (message) => {
    pushes.push(message);
    return message.token === 'dead-token-0000' ? { sent: false, invalidToken: true } : { sent: true };
  };

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (token, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const admin = await User.create({ role: 'ADMIN', name: 'Meera Admin', email: 'meera@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const viewer = await User.create({ role: 'ADMIN', email: 'viewer@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['notifications.broadcast.view'] });
  const asAdmin = (...args) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), ...args);
  const asViewer = (...args) => call(signAccessToken({ sub: String(viewer._id), role: 'ADMIN' }), ...args);

  const customer = (n) => User.create({ role: 'CUSTOMER', name: `Customer ${n}`, email: `c${n}@arise.test`, passwordHash: 'x', status: 'ACTIVE' });
  const [android, iphone, optedOut, noPhone] = await Promise.all([customer(1), customer(2), customer(3), customer(4)]);
  await User.create({ role: 'CUSTOMER', name: 'Gone', email: 'gone@arise.test', passwordHash: 'x', status: 'DEACTIVATED' });
  const device = (user, deviceId, token, platform) => Device.create({ userId: String(user._id), deviceId, token, platform });
  await Promise.all([
    device(android, 'd1', 'android-token-1', 'android'),
    device(iphone, 'd2', 'ios-token-2222', 'ios'),
    device(optedOut, 'd3', 'android-token-3', 'android'),
    device(noPhone, 'd4', 'dead-token-0000', 'android'),
  ]);
  await Preference.create({ customerId: String(optedOut._id), offers: false });
  const [shop, pendingShop] = await Promise.all([Seller.create({ storeName: 'Nova', status: 'ACTIVE' }), Seller.create({ storeName: 'Pending Co', status: 'UNDER_REVIEW' })]);

  const valid = { title: 'Festive offers are live', message: 'Open Arise to shop now.', campaignName: 'Diwali', audiences: ['CUSTOMERS', 'SELLERS'], platforms: ['ANDROID', 'IOS'] };
  const settled = async (id) => {
    for (let i = 0; i < 100; i += 1) {
      const row = await PushBroadcast.findById(id).lean();
      if (['SENT', 'FAILED', 'EXPIRED'].includes(row.status)) return row;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('broadcast never finished');
  };

  // who may use it, and what is valid
  assert.equal((await call(null, 'GET', '/admin/v1/push-broadcasts')).status, 401);
  assert.equal((await asViewer('GET', '/admin/v1/push-broadcasts')).status, 200);
  assert.equal((await asViewer('POST', '/admin/v1/push-broadcasts', valid)).status, 403);
  for (const bad of [{ title: '' }, { message: 'x'.repeat(241) }, { audiences: [] }, { audiences: ['ADMINS'] }, { platforms: ['WEB'] }, { imageUrl: 'http://insecure.test/a.jpg' }, { deepLink: 'javascript:alert(1)' }, { expiresAt: '2020-01-01T00:00:00Z' }]) {
    assert.equal((await asAdmin('POST', '/admin/v1/push-broadcasts', { ...valid, ...bad })).status, 422, JSON.stringify(bad));
  }

  // the audience the form shows
  assert.deepEqual((await asAdmin('GET', '/admin/v1/push-broadcasts/audience?platforms=ANDROID')).body.data, { customers: 4, customersWithPush: 3, sellers: 1, pushConfigured: true });
  assert.equal((await asAdmin('GET', '/admin/v1/push-broadcasts/audience?platforms=IOS')).body.data.customersWithPush, 1);

  // send now to customers and sellers, iPhones only
  const sent = await asAdmin('POST', '/admin/v1/push-broadcasts', { ...valid, platforms: ['IOS'], deepLink: 'arise://offers/diwali', imageUrl: 'https://cdn.test/a.jpg', collapseKey: 'sale', priority: 'HIGH' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.data.createdByName, 'Meera Admin');
  const done = await settled(sent.body.data.id);
  assert.equal(done.status, 'SENT');
  assert.equal(await Notification.countDocuments({ recipientType: 'CUSTOMER', deduplicationKey: `broadcast:${done._id}` }), 4, 'every active customer gets it in their list');
  assert.equal(await Notification.countDocuments({ recipientType: 'SELLER', recipientId: String(shop._id), deduplicationKey: `broadcast:${done._id}` }), 1);
  assert.equal(await Notification.countDocuments({ recipientType: 'SELLER', recipientId: String(pendingShop._id) }), 0, 'a seller who is not approved gets nothing');
  assert.equal(done.inboxCount, 5);
  assert.deepEqual(pushes.map((push) => push.token), ['ios-token-2222'], 'only the iPhone is pushed');
  assert.deepEqual([pushes[0].title, pushes[0].image, pushes[0].priority, pushes[0].collapseKey, pushes[0].data.deepLink], ['Festive offers are live', 'https://cdn.test/a.jpg', 'high', 'sale', 'arise://offers/diwali']);
  assert.equal(done.pushSent, 1);

  // Android: the customer who turned offers off, and the one whose token Firebase rejects
  pushes.length = 0;
  const second = await asAdmin('POST', '/admin/v1/push-broadcasts', { ...valid, audiences: ['CUSTOMERS'], platforms: ['ANDROID'], campaignName: 'Second' });
  const secondDone = await settled(second.body.data.id);
  assert.deepEqual(pushes.map((push) => push.token).sort(), ['android-token-1', 'dead-token-0000'], 'opted-out customers are not pushed');
  assert.deepEqual([secondDone.pushSent, secondDone.pushFailed], [1, 1]);
  assert.ok((await Device.findOne({ token: 'dead-token-0000' })).invalidAt, 'a dead token is retired');
  const inbox = await Notification.findOne({ recipientType: 'CUSTOMER', recipientId: String(optedOut._id), deduplicationKey: `broadcast:${secondDone._id}` });
  assert.ok(inbox, 'an opted-out customer still sees it in the app list');
  assert.equal(inbox.category, 'OFFER');

  // dispatching twice never tells anyone twice
  pushes.length = 0;
  await PushBroadcast.updateOne({ _id: secondDone._id }, { $set: { status: 'SCHEDULED', scheduleAt: new Date(Date.now() - 1000) } });
  await dispatchDueBroadcasts();
  assert.equal(await Notification.countDocuments({ deduplicationKey: `broadcast:${secondDone._id}` }), 4);
  assert.equal(pushes.length, 0, 'a re-run pushes nobody it already told');

  // scheduled for later: waits, can be cancelled; one in the past goes out on the next minute job
  pushes.length = 0;
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const later = await asAdmin('POST', '/admin/v1/push-broadcasts', { ...valid, audiences: ['CUSTOMERS'], scheduleAt: soon, campaignName: 'Later' });
  assert.equal(later.body.data.status, 'SCHEDULED');
  await dispatchDueBroadcasts();
  assert.equal((await PushBroadcast.findById(later.body.data.id)).status, 'SCHEDULED', 'not due yet');
  assert.equal((await asAdmin('POST', `/admin/v1/push-broadcasts/${later.body.data.id}/cancel`)).body.data.status, 'CANCELLED');
  assert.equal((await asAdmin('POST', `/admin/v1/push-broadcasts/${later.body.data.id}/cancel`)).status, 409, 'already cancelled');
  const due = await PushBroadcast.create({ ...valid, audiences: ['SELLERS'], campaignName: 'Due', createdBy: String(admin._id), scheduleAt: new Date(Date.now() - 1000) });
  const expiredOne = await PushBroadcast.create({ ...valid, campaignName: 'Late', createdBy: String(admin._id), scheduleAt: new Date(Date.now() - 5000), expiresAt: new Date(Date.now() - 1000) });
  assert.equal(await dispatchDueBroadcasts(), 1, 'the expired one is not sent');
  assert.equal((await PushBroadcast.findById(due._id)).status, 'SENT');
  assert.equal((await PushBroadcast.findById(expiredOne._id)).status, 'EXPIRED');
  assert.equal(pushes.length, 0);

  const history = (await asAdmin('GET', '/admin/v1/push-broadcasts')).body.data;
  assert.equal(history[0].campaignName, 'Late');
  assert.ok(history.some((row) => row.campaignName === 'Diwali' && row.pushSent === 1));
});
