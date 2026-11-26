// "Similar Products" and "Products you may like": the ranking, without a database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
});
const { relatedFrom } = await import('../src/modules/product/application/customerCatalog.service.js');

const card = (id, rootCategory, category, brandId, pricePaise, mrpPaise = pricePaise) => ({ id, rootCategory, category, brandId, pricePaise, mrpPaise });
const shelf = [
  card('self', 'Mobiles', 'Smartphones', 'samsung', 50_000),
  card('far', 'Mobiles', 'Smartphones', 'xiaomi', 90_000),
  card('near', 'Mobiles', 'Smartphones', 'xiaomi', 52_000),
  card('same-brand', 'Mobiles', 'Smartphones', 'samsung', 95_000),
  card('case', 'Mobiles', 'Cases', 'xiaomi', 500, 1_000),
  card('shirt', 'Fashion', 'Shirts', 'roadster', 800, 2_000),
  card('shoe', 'Fashion', 'Shoes', 'hrx', 900, 1_000),
];

test('similar: same shelf only, same brand first, then the nearest price; never the product itself', () => {
  const { similar } = relatedFrom(shelf, 'self');
  assert.deepEqual(similar.map((c) => c.id), ['same-brand', 'near', 'far']);
});

test('suggested: the rest, own wider category first, then best discount; nothing from similar', () => {
  const { similar, suggested } = relatedFrom(shelf, 'self');
  assert.deepEqual(suggested.map((c) => c.id), ['case', 'shirt', 'shoe']);
  assert.ok(!suggested.some((c) => similar.some((s) => s.id === c.id)));
});

test('a shopper\'s viewing history pulls their categories up; what they already saw goes last, not away', () => {
  const { suggested } = relatedFrom(shelf, 'self', new Set(['shoe', 'case']));
  assert.deepEqual(suggested.map((c) => c.id), ['shirt', 'case', 'shoe'], 'unseen first (Fashion is a viewed root), seen ones after');
});

test('limits apply, and an unknown or off-shelf product gets empty lists', () => {
  const { similar, suggested } = relatedFrom(shelf, 'self', new Set(), { similarLimit: 1, suggestedLimit: 2 });
  assert.equal(similar.length, 1);
  assert.equal(suggested.length, 2);
  assert.deepEqual(relatedFrom(shelf, 'missing'), { similar: [], suggested: [] });
});
