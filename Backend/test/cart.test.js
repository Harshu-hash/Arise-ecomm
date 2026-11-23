// Pure-logic tests for the cart's money rules (no database needed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTotals, couponSaving } from '../src/modules/cart/domain/services/cartRules.js';

const fees = { platformFeePaise: 500, deliveryFeePaise: 4000, deliveryFeeFreeThresholdPaise: 49_900 };
const line = (unitPricePaise, quantity, mrpPaise = unitPricePaise) => ({ unitPricePaise, quantity, mrpPaise });

test('an empty cart owes nothing, not even fees', () => {
  assert.deepEqual(computeTotals([], { fees }), { mrpPaise: 0, subtotalPaise: 0, productDiscountPaise: 0, couponDiscountPaise: 0, deliveryFeePaise: 0, platformFeePaise: 0, payablePaise: 0 });
});

test('totals add up: items, product discount, delivery and platform fee', () => {
  const totals = computeTotals([line(30_000, 1, 40_000), line(5_000, 2, 6_000)], { fees });
  assert.deepEqual(totals, {
    mrpPaise: 52_000, subtotalPaise: 40_000, productDiscountPaise: 12_000, couponDiscountPaise: 0,
    deliveryFeePaise: 4000, platformFeePaise: 500, payablePaise: 44_500,
  });
});

test('delivery is free from the threshold, exactly', () => {
  assert.equal(computeTotals([line(49_899, 1)], { fees }).deliveryFeePaise, 4000);
  assert.equal(computeTotals([line(49_900, 1)], { fees }).deliveryFeePaise, 0);
});

test('a coupon never takes off more than it can: items for most kinds, the delivery fee for delivery coupons', () => {
  const flat = { type: 'FLAT', discountPaise: 5_000 };
  assert.equal(computeTotals([line(30_000, 1)], { coupon: flat, fees }).couponDiscountPaise, 5_000);
  assert.equal(computeTotals([line(3_000, 1)], { coupon: flat, fees }).couponDiscountPaise, 3_000); // not more than the items
  const delivery = { type: 'FREE_DELIVERY', discountPaise: 4_000 };
  assert.equal(computeTotals([line(30_000, 1)], { coupon: delivery, fees }).couponDiscountPaise, 4_000);
  assert.equal(computeTotals([line(60_000, 1)], { coupon: delivery, fees }).couponDiscountPaise, 0); // delivery is already free
  assert.equal(couponSaving({ type: 'FREE_DELIVERY', discountPaise: 9_999 }, { subtotalPaise: 30_000, deliveryFeePaise: 4_000 }), 4_000);
  assert.equal(couponSaving(null, { subtotalPaise: 1, deliveryFeePaise: 1 }), 0);
});

test('the amount to pay is never negative, even with a coupon bigger than everything', () => {
  const totals = computeTotals([line(100, 1)], { coupon: { type: 'FLAT', discountPaise: 99_999 }, fees });
  assert.equal(totals.couponDiscountPaise, 100);
  assert.equal(totals.payablePaise, 100 - 100 + 4000 + 500);
});

test('a price above its MRP never shows a negative product discount', () => {
  assert.equal(computeTotals([line(1_200, 1, 1_000)], { fees }).productDiscountPaise, 0);
});
