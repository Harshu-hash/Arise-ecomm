// Product search: the pure rules, then (with TEST_MONGODB_URI) search, suggestions, trending and recent searches over HTTP.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-search-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const { cardMatches, rankByPopularity, rankByRelevance, relevanceScore, tokenize } = await import('../src/modules/product/domain/services/searchRules.js');
const { cleanQuery } = await import('../src/modules/search/domain/services/searchQueryRules.js');

test('search rules: words match in any order, the best name match ranks first, sold-out items sink', () => {
  assert.deepEqual(tokenize('  Nike   running SHOES nike '), ['nike', 'running', 'shoes']);
  assert.deepEqual(tokenize('   '), []);
  assert.equal(tokenize('a b c d e f g h').length, 6, 'at most six words are used');

  const card = (name, extra = {}) => ({ id: name, name, brand: 'Acme', category: 'Shoes', rootCategory: 'Fashion', inStock: true, ratingCount: 0, ...extra });
  const exact = card('Running Shoes');
  const longer = card('Nike Revolution Running Shoes', { brand: 'Nike' });
  const soldOut = card('Running Shoes Pro', { inStock: false });
  assert.equal(cardMatches(longer, tokenize('shoes nike')), true);
  assert.equal(cardMatches(longer, tokenize('nike sandals')), false);
  assert.ok(relevanceScore(exact, tokenize('running shoes')) > relevanceScore(longer, tokenize('running shoes')));
  assert.deepEqual(rankByRelevance([soldOut, longer, exact], tokenize('running shoes')).map((c) => c.name), ['Running Shoes', 'Nike Revolution Running Shoes', 'Running Shoes Pro']);
  assert.deepEqual(rankByRelevance([card('B'), card('A')], []).map((c) => c.name), ['B', 'A'], 'no query keeps the incoming (newest first) order');

  const sales = new Map([['Nike Revolution Running Shoes', 9]]);
  assert.deepEqual(rankByPopularity([exact, longer], tokenize('shoes'), sales).map((c) => c.name), ['Nike Revolution Running Shoes', 'Running Shoes']);
});

test('search queries worth remembering: tidy, not too short or long, never contact details', () => {
  assert.deepEqual(cleanQuery('  Nike   Shoes '), { key: 'nike shoes', text: 'Nike Shoes' });
  assert.equal(cleanQuery('a'), null);
  assert.equal(cleanQuery('!!!'), null);
  assert.equal(cleanQuery('call 9876543210'), null);
  assert.equal(cleanQuery('me@example.com'), null);
  assert.equal(cleanQuery('x'.repeat(61)), null);
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

test('search over HTTP: any-order words, relevance and popularity, suggestions, trending and recent searches', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Brand } = await import('../src/modules/catalog/infrastructure/persistence/brand.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { Order } = await import('../src/modules/order/public/index.js');
  const { SearchQueryStat, SearchHistory } = await import('../src/modules/search/infrastructure/persistence/search.models.js');
  await Promise.all([Category.init(), Brand.init(), Product.init(), Offer.init(), Variant.init(), Order.init(), SearchQueryStat.init(), SearchHistory.init()]);

  const rootId = new mongoose.Types.ObjectId();
  await Category.create({ _id: rootId, name: 'Fashion', nameKey: 'search fashion', slug: 'search-fashion', parentId: null, rootId, level: 1, sortOrder: 1 });
  const brands = {};
  for (const name of ['Nike', 'Puma', 'Generic', 'Acme']) brands[name] = await Brand.create({ name, nameKey: name.toLowerCase(), status: 'VERIFIED' });

  let n = 0;
  const make = async (title, brand, leaf, { stock = 5 } = {}) => {
    n += 1;
    const product = await Product.create({
      title, status: 'LIVE', categoryId: rootId, rootCategoryId: rootId, categoryPath: `Fashion › ${leaf}`, brandId: brands[brand]._id, brandName: brand,
      images: [`public/products/s1/${n}.png`], createdBySellerId: 's1',
    });
    const variant = await Variant.create({ productId: product._id, sku: `S-${n}`, attributes: { size: 'M' }, label: 'M', weightG: 100, dimsCm: { l: 1, w: 1, h: 1 } });
    await Offer.create({ productId: product._id, variantId: variant._id, sellerId: 's1', sellingPricePaise: 1000, mrpPaise: 1500, stock, status: 'LIVE' });
    return product;
  };
  const nike = await make('Nike Revolution Running Shoes', 'Nike', 'Running Shoes');
  const puma = await make('Puma Electrify Running Shoes', 'Puma', 'Running Shoes');
  await make('Running Shoes', 'Generic', 'Running Shoes');
  await make('Acme Cotton Shirt', 'Acme', 'Shirts');
  await make('Nike Running Shoes Sold Out', 'Nike', 'Running Shoes', { stock: 0 });

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1`;
  const call = async (method, path, { token, body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const names = async (path) => (await call('GET', path)).body.data.items.map((item) => item.name);

  // every word must match, in any order; the best match first, sold out last
  assert.deepEqual(await names('/search?q=nike%20shoes'), ['Nike Revolution Running Shoes', 'Nike Running Shoes Sold Out']);
  assert.deepEqual(await names('/search?q=shoes%20nike'), ['Nike Revolution Running Shoes', 'Nike Running Shoes Sold Out']);
  assert.deepEqual(await names('/search?q=nike%20sandals'), []);
  const ranked = await names('/search?q=running%20shoes');
  assert.deepEqual([ranked[0], ranked.at(-1)], ['Running Shoes', 'Nike Running Shoes Sold Out']);
  assert.equal((await call('GET', '/search?q=shirt')).body.data.total, 1);

  // popularity follows what actually sold in recent orders
  const sold = (productId, quantity, number) => Order.create({
    number, customerId: 'c1', checkoutSessionId: new mongoose.Types.ObjectId(), paymentId: new mongoose.Types.ObjectId(), paymentMethod: 'upi',
    address: { city: 'Pune' }, totals: { payablePaise: 1000 }, subOrders: [{ sellerId: 's1', status: 'DELIVERED', items: [{ productId: String(productId), quantity }], events: [] }],
  });
  await sold(puma._id, 10, 'S1');
  await sold(nike._id, 2, 'S2');
  assert.deepEqual((await names('/search?q=shoes&sort=popularity')).slice(0, 2), ['Puma Electrify Running Shoes', 'Nike Revolution Running Shoes']);

  // suggestions: completions, then brands and categories that match a typed word; none for nonsense or nothing
  const asNike = (await call('GET', '/search/suggestions?q=nike')).body.data;
  assert.equal(asNike.suggestions[0].type, 'arrow');
  assert.ok(asNike.suggestions.every((item) => typeof item.imageUrl === 'string' && item.id && item.text));
  assert.deepEqual(asNike.suggestions.find((item) => item.type === 'chevron'), { ...asNike.suggestions.find((item) => item.type === 'chevron'), text: 'Nike', category: 'Brand' });
  const asRunning = (await call('GET', '/search/suggestions?q=running')).body.data;
  assert.deepEqual(asRunning.suggestions.find((item) => item.id === 'c:Running Shoes'), { ...asRunning.suggestions.find((item) => item.id === 'c:Running Shoes'), text: 'Running Shoes', category: 'in Fashion', type: 'chevron' });
  assert.ok(asRunning.prompts.length > 0);
  for (const prompt of asRunning.prompts) assert.ok((await call('GET', `/search/?q=${encodeURIComponent(prompt)}`)).body.data.total > 0, `"${prompt}" must find something`);
  assert.deepEqual((await call('GET', '/search/suggestions?q=zzzz')).body.data.suggestions, []);
  const empty = (await call('GET', '/search/suggestions')).body.data;
  assert.deepEqual(empty.suggestions, []);

  // trending: the shelf's biggest brands and departments until people search, then what they really searched
  assert.deepEqual(empty.trending.slice(0, 2), ['Nike', 'Acme']);
  assert.ok(empty.trending.includes('Fashion'));
  await SearchQueryStat.deleteMany({}); // forget the searches the checks above made
  await call('GET', '/search?q=nike%20shoes');
  await call('GET', '/search?q=nike%20shoes&cursor=12'); // paging is not a new search
  await call('GET', '/search?q=nike%20sandals'); // found nothing: not counted
  await call('GET', '/search?q=Nike%20Shoes');
  for (let i = 0; i < 20 && !(await SearchQueryStat.countDocuments({ count: { $gte: 2 } })); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  const trending = (await call('GET', '/search/suggestions?q=')).body.data.trending;
  assert.equal(trending[0], 'nike shoes');
  assert.ok(!trending.includes('nike sandals'));

  // recent searches: the signed-in customer's own, newest first, repeats move up, capped, never contact details
  const me = signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'CUSTOMER' });
  const other = signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'CUSTOMER' });
  assert.equal((await call('GET', '/search/recent')).status, 401);
  assert.equal((await call('POST', '/search/recent', { token: me, body: { query: '' } })).status, 422);
  const add = (query, token = me) => call('POST', '/search/recent', { token, body: { query } });
  await add('boat earbuds');
  await add('running shoes');
  const again = await add('Boat Earbuds');
  assert.deepEqual(again.body.data.items, ['Boat Earbuds', 'running shoes']);
  assert.deepEqual((await add('9876543210')).body.data.items, ['Boat Earbuds', 'running shoes'], 'a phone number is not kept');
  for (let i = 0; i < 24; i += 1) await add(`query number ${i}`);
  assert.equal((await call('GET', '/search/recent', { token: me })).body.data.items.length, 8, 'eight are shown');
  assert.equal(await SearchHistory.countDocuments({ userId: { $ne: 'x' } }), 20, 'twenty are kept');
  assert.deepEqual((await call('GET', '/search/recent', { token: other })).body.data.items, []);
  assert.equal((await call('DELETE', '/search/recent', { token: me })).body.data.cleared, true);
  assert.deepEqual((await call('GET', '/search/recent', { token: me })).body.data.items, []);
});
