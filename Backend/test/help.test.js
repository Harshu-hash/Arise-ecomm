// Help Center: public articles and search, a customer's own helpful/not helpful answer, and the seller's contact options.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-help-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const { searchHelp } = await import('../src/modules/support/application/help.service.js');

test('help search: matches title, summary and body; a one-letter query matches nothing', () => {
  assert.ok(searchHelp('refund').total > 0);
  assert.equal(searchHelp('REFUND').query, 'refund');
  assert.equal(searchHelp('r').total, 0);
  assert.ok(searchHelp('refund').items.every((item) => item.body === undefined), 'search results carry no article body');
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

test('help center over HTTP: public reads, per-customer feedback, seller channels', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { HelpFeedback } = await import('../src/modules/support/infrastructure/persistence/helpFeedback.model.js');
  await HelpFeedback.init();
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
  const customerId = String(new mongoose.Types.ObjectId());
  const asCustomer = (...args) => call(signAccessToken({ sub: customerId, role: 'CUSTOMER' }), ...args);

  const categories = (await call(null, 'GET', '/customer/v1/help/categories')).body.data.items;
  assert.ok(categories.length > 1);
  assert.equal(categories[0].articles[0].body, undefined, 'the list carries summaries, not bodies');
  assert.equal((await call(null, 'GET', `/customer/v1/help/categories/${categories[0].id}`)).body.data.id, categories[0].id);
  assert.equal((await call(null, 'GET', '/customer/v1/help/categories/nope')).status, 404);

  const articleId = categories[0].articles[0].id;
  const article = (await call(null, 'GET', `/customer/v1/help/articles/${articleId}`)).body.data;
  assert.deepEqual([typeof article.body, article.viewerFeedback], ['string', null]);
  assert.equal((await call(null, 'GET', '/customer/v1/help/search?query=refund')).body.data.total > 0, true);

  // feedback needs a customer, is remembered for that customer only, and can be changed
  assert.equal((await call(null, 'PUT', `/customer/v1/help/articles/${articleId}/feedback`, { helpful: true })).status, 401);
  assert.equal((await asCustomer('PUT', `/customer/v1/help/articles/${articleId}/feedback`, { helpful: 'yes' })).status, 422);
  assert.equal((await asCustomer('PUT', `/customer/v1/help/articles/${articleId}/feedback`, { helpful: true })).body.data.viewerFeedback, 'HELPFUL');
  assert.equal((await asCustomer('PUT', `/customer/v1/help/articles/${articleId}/feedback`, { helpful: false })).body.data.viewerFeedback, 'NOT_HELPFUL');
  assert.equal((await asCustomer('GET', `/customer/v1/help/articles/${articleId}`)).body.data.viewerFeedback, 'NOT_HELPFUL');
  assert.equal((await call(null, 'GET', `/customer/v1/help/articles/${articleId}`)).body.data.viewerFeedback, null);
  assert.equal(await HelpFeedback.countDocuments({ articleId }), 1);
  assert.equal((await asCustomer('PUT', '/customer/v1/help/articles/nope/feedback', { helpful: true })).status, 404);

  // sellers get phone and email but not chat; customers cannot use the seller route
  const seller = signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER', sellerId: String(new mongoose.Types.ObjectId()) });
  const channels = (await call(seller, 'GET', '/seller/v1/support/channels')).body.data.channels;
  assert.deepEqual(channels.map((channel) => channel.type), ['PHONE', 'EMAIL']);
  assert.equal((await asCustomer('GET', '/seller/v1/support/channels')).status, 403);
});
