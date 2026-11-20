// Pure-logic tests for coupons, deals and the home layout (no database needed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { arrangeHomeSections, cleanConfig, sectionErrors } from '../src/modules/admin/domain/services/homeLayoutRules.js';
import { couponCreateSchema } from '../src/modules/coupon/presentation/coupon.routes.js';
import { couponErrors, evaluateCoupon } from '../src/modules/coupon/domain/services/couponRules.js';
import { dealErrors, dealStatus, isCalendarDay, istDate, slotError } from '../src/modules/coupon/domain/services/dealRules.js';

const NOW = new Date('2026-06-15T10:00:00.000Z');
const day = (offset) => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);
const coupon = (over = {}) => ({
  status: 'ACTIVE', type: 'PERCENT', valuePct: 10, maxDiscountPaise: null, minCartPaise: 0, perUserLimit: 1, totalLimit: 100,
  totalRedemptions: 0, budgetPaise: 1_000_000, budgetUsedPaise: 0, startsAt: day(-1), endsAt: day(10), audience: { type: 'ALL', customerIds: [] }, ...over,
});
const cart = (prices, over = {}) => ({ customer: { id: 'c1', ordersCount: 0 }, items: prices.map((pricePaise, i) => ({ productId: `p${i}`, pricePaise, qty: 1 })), ...over });

test('percent coupons honour the cap and the remaining budget', () => {
  assert.equal(evaluateCoupon(coupon(), cart([100_000, 100_000])).discountPaise, 20_000);
  assert.equal(evaluateCoupon(coupon({ maxDiscountPaise: 5_000 }), cart([100_000, 100_000])).discountPaise, 5_000);
  assert.equal(evaluateCoupon(coupon({ budgetPaise: 10_000, budgetUsedPaise: 8_000 }), cart([100_000])).discountPaise, 2_000);
});

test('flat and buy-x-get-y coupons discount the right amount', () => {
  assert.equal(evaluateCoupon(coupon({ type: 'FLAT', valuePaise: 30_000 }), cart([20_000])).discountPaise, 20_000); // never more than the cart
  const bxgy = coupon({ type: 'BXGY', buyQty: 2, getQty: 1 });
  assert.equal(evaluateCoupon(bxgy, cart([50_000, 30_000, 70_000])).discountPaise, 30_000); // cheapest of three is free
  assert.equal(evaluateCoupon(bxgy, cart([50_000, 30_000])).discountPaise, 0);
});

test('a coupon explains why it does not apply', () => {
  const result = evaluateCoupon(coupon({ status: 'PAUSED', minCartPaise: 500_000 }), cart([100_000]));
  assert.equal(result.applicable, false);
  assert.equal(result.discountPaise, 0);
  assert.equal(result.reasons.length, 2);
  assert.match(evaluateCoupon(coupon(), cart([])).reasons[0], /empty/);
  assert.equal(evaluateCoupon(coupon({ audience: { type: 'NEW' } }), cart([100_000], { customer: { id: 'c1', ordersCount: 2 } })).applicable, false);
  assert.equal(evaluateCoupon(coupon({ audience: { type: 'CUSTOM', customerIds: ['c2'] } }), cart([100_000])).applicable, false);
  assert.equal(evaluateCoupon(coupon(), cart([100_000]), NOW).applicable, true);
  assert.equal(evaluateCoupon(coupon(), cart([100_000], { redeemedByCustomer: 1 })).applicable, false);
});

test('inconsistent coupons are caught with field errors', () => {
  assert.equal(couponErrors(coupon(), NOW), null);
  assert.ok(couponErrors(coupon({ endsAt: day(-2) }), NOW).endsAt);
  assert.ok(couponErrors(coupon({ startsAt: day(5), endsAt: day(2) }), NOW).endsAt);
  assert.ok(couponErrors(coupon({ perUserLimit: 5, totalLimit: 3 }), NOW).perUserLimit);
  assert.ok(couponErrors(coupon({ type: 'FLAT', valuePaise: 50_000, budgetPaise: 10_000 }), NOW).budgetPaise);
  assert.ok(couponErrors(coupon({ type: 'FLAT', valuePaise: 50_000, minCartPaise: 20_000 }), NOW).valuePaise);
  assert.ok(couponErrors(coupon({ totalLimit: 2, totalRedemptions: 3 }), NOW).totalLimit);
});

test('coupon create schema normalises the code and clears fields from other discount types', () => {
  const base = { code: ' save10 ', name: 'Save', type: 'PERCENT', valuePct: 10, valuePaise: 500, buyQty: 2, totalLimit: 10, perUserLimit: 1, budgetPaise: 10_000, startsAt: '2026-06-15', endsAt: '2026-07-15' };
  const parsed = couponCreateSchema.parse(base);
  assert.equal(parsed.code, 'SAVE10');
  assert.equal(parsed.valuePaise, null);
  assert.equal(parsed.buyQty, null);
  assert.equal(parsed.maxDiscountPaise, null);
  assert.deepEqual(parsed.audience, { type: 'ALL' });
  assert.equal(couponCreateSchema.safeParse({ ...base, valuePct: undefined }).success, false); // percent needs its value
  assert.equal(couponCreateSchema.safeParse({ ...base, valuePct: 150 }).success, false);
  assert.equal(couponCreateSchema.safeParse({ ...base, code: 'a b' }).success, false);
  assert.equal(couponCreateSchema.safeParse({ ...base, audience: { type: 'CUSTOM', customerIds: [] } }).success, false);
  assert.equal(couponCreateSchema.safeParse({ ...base, type: 'FREE_DELIVERY', valuePct: undefined }).success, true);
});

test('deal slots are India calendar days inside the deal window', () => {
  assert.equal(istDate(new Date('2026-06-15T20:00:00.000Z')), '2026-06-16'); // already tomorrow in India
  assert.equal(isCalendarDay('2026-02-28'), true);
  assert.equal(isCalendarDay('2026-02-30'), false);
  assert.equal(isCalendarDay('tomorrow'), false);
  const window = { startsAt: NOW, endsAt: day(5) };
  assert.equal(slotError('2026-06-16', window, NOW), null);
  assert.match(slotError('2026-06-14', window, NOW), /past/);
  assert.match(slotError('2026-06-25', window, NOW), /within/);
});

test('deals must undercut the shelf price and end in the future', () => {
  const ok = { dealPricePaise: 80_000, shelfPricePaise: 100_000, startsAt: NOW, endsAt: day(3), slotDate: '2026-06-16' };
  assert.equal(dealErrors(ok, NOW), null);
  assert.ok(dealErrors({ ...ok, dealPricePaise: 100_000 }, NOW).dealPricePaise);
  assert.ok(dealErrors({ ...ok, endsAt: day(-1) }, NOW).endsAt);
  assert.ok(dealErrors({ ...ok, endsAt: day(200) }, NOW).endsAt);
  assert.ok(dealErrors({ ...ok, slotDate: '2026-07-30' }, NOW).slotDate);
  assert.deepEqual([dealStatus({ startsAt: day(1), endsAt: day(2) }, NOW), dealStatus({ startsAt: day(-2), endsAt: day(-1) }, NOW), dealStatus(ok, NOW)], ['SCHEDULED', 'ENDED', 'ACTIVE']);
});

test('home layouts reject duplicates and bad item limits, drop foreign settings, and apply to the customer sections', () => {
  const s = (type, enabled = true, config = {}) => ({ type, config, visibility: { enabled } });
  assert.equal(sectionErrors([s('PRODUCT_FEED'), s('AD_TILE_ROW'), s('AD_TILE_ROW')]), null);
  assert.ok(sectionErrors([s('PRODUCT_FEED'), s('PRODUCT_FEED')]).sections);
  assert.equal(sectionErrors([s('PRODUCT_FEED', true, { maxItems: 12 })]), null);
  for (const maxItems of [0, 31, 2.5, '5']) assert.ok(sectionErrors([s('PRODUCT_FEED', true, { maxItems })]).sections);

  assert.deepEqual(cleanConfig('PRODUCT_FEED', { maxItems: 8, autoplayMs: 4000, title: 'x' }), { maxItems: 8 });
  assert.deepEqual(cleanConfig('FLASH_SALE_BANNER', { maxItems: 8 }), {}); // this section has no item limit
  assert.deepEqual(cleanConfig('PRODUCT_FEED', {}), {});

  const built = [{ type: 'HERO' }, { type: 'PROMO_CAROUSEL' }, { type: 'PRODUCT_FEED', items: [1, 2, 3, 4, 5] }];
  assert.equal(arrangeHomeSections(built, null), built); // nothing published: untouched
  const layout = [s('PRODUCT_FEED', true, { maxItems: 2 }), s('HERO_BANNER_CAROUSEL', false), s('AD_TILE_ROW')];
  const arranged = arrangeHomeSections(built, layout);
  assert.deepEqual(arranged.map((x) => x.type), ['PRODUCT_FEED', 'PROMO_CAROUSEL']);
  assert.deepEqual(arranged[0].items, [1, 2]);
  assert.equal(built[2].items.length, 5); // the built section is not mutated
});
