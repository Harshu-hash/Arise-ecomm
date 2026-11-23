// Pure-logic tests for order money (no database needed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { allocate, priceOrder } from '../src/modules/order/domain/services/orderMoney.js';

const terms = new Map([['c1', { gstRate: 18, hsnCode: '6109', commissionPct: 10 }], ['c2', { gstRate: 5, hsnCode: '6203', commissionPct: 0 }]]);
const line = (sellerId, categoryId, unitPricePaise, quantity, mrpPaise = unitPricePaise) => ({ offerId: `${sellerId}${categoryId}`, sellerId, categoryId, unitPricePaise, quantity, mrpPaise });

test('allocate: parts always add up to the total, in proportion', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(0, [5, 5]), [0, 0]);
  assert.equal(allocate(999, [3, 7, 11]).reduce((a, b) => a + b, 0), 999);
});

test('totals: items, one delivery fee per seller, platform fee; GST and commission come out of the price', () => {
  const order = priceOrder({
    lines: [line('s1', 'c1', 11_800, 1, 15_000), line('s2', 'c2', 10_500, 2)],
    shipping: new Map([['s1', 4_000], ['s2', 6_000]]),
    platformFeePaise: 500,
    terms,
  });
  assert.equal(order.totals.subtotalPaise, 32_800);
  assert.equal(order.totals.deliveryFeePaise, 10_000);
  assert.equal(order.totals.payablePaise, 32_800 + 10_000 + 500);
  assert.equal(order.totals.productDiscountPaise, 3_200);
  assert.equal(order.lines[0].gstPaise, 1_800); // 11800 * 18/118
  assert.equal(order.lines[0].commissionPaise, 1_180);
  assert.equal(order.lines[1].gstPaise, 1_000); // 21000 * 5/105
  assert.equal(order.totals.taxPaise, 2_800);
  assert.deepEqual(order.sellers.map((seller) => seller.payablePaise), [15_800, 27_000]);
});

test('an items coupon is shared over the lines, lowering the GST and commission base too, and never exceeds the items', () => {
  const order = priceOrder({
    lines: [line('s1', 'c1', 10_000, 1), line('s2', 'c1', 20_000, 1)],
    shipping: new Map([['s1', 0], ['s2', 0]]),
    coupon: { type: 'FLAT', discountPaise: 3_000 },
    terms,
  });
  assert.deepEqual(order.lines.map((l) => l.discountPaise), [1_000, 2_000]);
  assert.equal(order.lines[0].commissionPaise, 900); // 10% of 9000
  assert.equal(order.totals.payablePaise, 27_000);
  const huge = priceOrder({ lines: [line('s1', 'c1', 1_000, 1)], shipping: new Map(), coupon: { type: 'FLAT', discountPaise: 5_000 }, terms });
  assert.equal(huge.totals.couponDiscountPaise, 1_000);
  assert.equal(huge.totals.payablePaise, 0);
});

test('a delivery coupon only covers delivery, shared over the sellers', () => {
  const order = priceOrder({
    lines: [line('s1', 'c1', 10_000, 1), line('s2', 'c1', 10_000, 1)],
    shipping: new Map([['s1', 4_000], ['s2', 4_000]]),
    coupon: { type: 'FREE_DELIVERY', discountPaise: 99_999 },
    terms,
  });
  assert.equal(order.totals.couponDiscountPaise, 8_000);
  assert.equal(order.totals.payablePaise, 20_000);
  assert.deepEqual(order.sellers.map((seller) => seller.shippingDiscountPaise), [4_000, 4_000]);
});

test('a category with no terms is taxed and charged commission at 0', () => {
  const order = priceOrder({ lines: [line('s1', 'zz', 5_000, 1)], shipping: new Map(), terms });
  assert.equal(order.lines[0].gstPaise, 0);
  assert.equal(order.lines[0].commissionPaise, 0);
});

test('cash on delivery: the handling fee is part of what is payable, not of any seller\'s parcel', () => {
  const order = priceOrder({ lines: [line('s1', 'c1', 11_800, 1)], shipping: new Map([['s1', 4_000]]), platformFeePaise: 500, codFeePaise: 1_500, terms });
  assert.deepEqual([order.totals.codFeePaise, order.totals.payablePaise, order.sellers[0].payablePaise], [1_500, 11_800 + 4_000 + 500 + 1_500, 15_800]);
});
