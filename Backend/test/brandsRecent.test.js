// The customer Brands page and "recently viewed" list, over HTTP against a real MongoDB (needs TEST_MONGODB_URI).
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-brands-')),
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

test('brands page and recently viewed: only what is on the shelf, filters, paging, per-customer history', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Brand } = await import('../src/modules/catalog/infrastructure/persistence/brand.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { RecentView } = await import('../src/modules/product/infrastructure/persistence/recentView.model.js');
  await Promise.all([Category.init(), Brand.init(), Product.init(), Offer.init(), Variant.init(), RecentView.init()]);

  const category = (name) => {
    const _id = new mongoose.Types.ObjectId();
    return { _id, name, nameKey: `brands ${name}`.toLowerCase(), slug: `brands-${name}`.toLowerCase(), parentId: null, rootId: _id, level: 1, sortOrder: 1 };
  };
  const fashion = category('Fashion');
  const electronics = category('Electronics');
  await Category.create([fashion, electronics]);

  const brand = (name, extra = {}) => Brand.create({ name, nameKey: name.toLowerCase(), status: 'VERIFIED', ...extra });
  const acme = await brand('Acme', { imageUrl: 'http://localhost/logo-acme.png' });
  const boom = await brand('Boom');
  const cozy = await brand('Cozy'); // nothing live: must not show

  let n = 0;
  const make = async (title, owner, root, { status = 'LIVE', price = 1000, mrp = 1500 } = {}) => {
    n += 1;
    const product = await Product.create({
      title, status, categoryId: root._id, rootCategoryId: root._id, categoryPath: root.name, brandId: owner._id, brandName: owner.name,
      images: [`public/products/s1/${n}.png`], createdBySellerId: 's1',
    });
    const variant = await Variant.create({ productId: product._id, sku: `SKU-${n}`, attributes: { size: 'M' }, label: 'M', weightG: 100, dimsCm: { l: 1, w: 1, h: 1 } });
    await Offer.create({ productId: product._id, variantId: variant._id, sellerId: 's1', sellingPricePaise: price, mrpPaise: mrp, stock: 5, status });
    return product;
  };
  const shirt = await make('Acme Shirt', acme, fashion);
  await make('Acme Jeans', acme, fashion);
  await make('Acme Cap', acme, fashion);
  const speaker = await make('Boom Speaker', boom, electronics, { price: 900, mrp: 900 });
  const draft = await make('Cozy Blanket', cozy, fashion, { status: 'QC_PENDING' });

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1`;
  const call = async (method, path, token) => {
    const response = await fetch(`${base}${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  };

  // brands: only brands with something to buy, with their discount and department
  const all = (await call('GET', '/brands?filter=All')).body.data;
  assert.deepEqual(all.filters, ['All', 'Popular', 'Electronics', 'Fashion']);
  assert.deepEqual(all.items.map((item) => item.name), ['Acme', 'Boom']);
  assert.deepEqual([all.items[0].category, all.items[0].offerText, all.items[0].imageUrl, all.items[0].popular], ['Fashion', 'Up to 33% Off', 'http://localhost/logo-acme.png', true]);
  assert.equal(all.items[1].offerText, null, 'no discount, no offer text');
  assert.equal(all.nextCursor, null);
  assert.deepEqual((await call('GET', '/brands?filter=Electronics')).body.data.items.map((item) => item.name), ['Boom']);
  assert.deepEqual((await call('GET', '/brands?filter=Nope')).body.data.items, []);
  const first = (await call('GET', '/brands?limit=1')).body.data;
  assert.deepEqual([first.items.map((item) => item.name), first.nextCursor], [['Acme'], '1']);
  assert.deepEqual((await call('GET', `/brands?limit=1&cursor=${first.nextCursor}`)).body.data.items.map((item) => item.name), ['Boom']);

  // recently viewed: signed-in only, newest first, products that left the shelf are skipped, one customer never sees another's
  const me = String(new mongoose.Types.ObjectId());
  const token = signAccessToken({ sub: me, role: 'CUSTOMER' });
  assert.equal((await call('GET', '/me/recently-viewed')).status, 401);
  assert.deepEqual((await call('GET', '/me/recently-viewed', token)).body.data.items, []);
  const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000);
  await RecentView.create([
    { userId: me, productId: shirt._id, viewedAt: at(30) },
    { userId: me, productId: speaker._id, viewedAt: at(5) },
    { userId: me, productId: draft._id, viewedAt: at(1) },
    { userId: String(new mongoose.Types.ObjectId()), productId: shirt._id, viewedAt: at(2) },
  ]);
  const seen = (await call('GET', '/me/recently-viewed', token)).body.data.items;
  assert.deepEqual(seen.map((item) => item.title), ['Boom Speaker', 'Acme Shirt']);
  assert.deepEqual([seen[0].productId, seen[0].subtitle, typeof seen[0].imageUrl, Number.isNaN(Date.parse(seen[0].viewedAt))], [String(speaker._id), 'Boom', 'string', false]);

  assert.equal((await call('DELETE', '/me/recently-viewed', token)).body.data.cleared, true);
  assert.deepEqual((await call('GET', '/me/recently-viewed', token)).body.data.items, []);
  assert.equal(await RecentView.countDocuments(), 1, "another customer's history is untouched");
});
