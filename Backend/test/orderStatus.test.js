// Pure-logic tests for order status rules and courier tracking (no database needed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyOf } from '../src/modules/order/domain/services/returnRules.js';
import { deliveredAtOf, deriveOrderStatus, isCancellable, nextActionOf, returnWindowEndsAt, stageOf } from '../src/modules/order/domain/services/orderStatus.js';
import { canAdvance, mapShiprocketStatus } from '../src/modules/shipping/domain/services/trackingStatus.js';

test('the order is as far along as its slowest live parcel; cancelled parcels do not count', () => {
  assert.equal(deriveOrderStatus(['CONFIRMED', 'DELIVERED']), 'CONFIRMED');
  assert.equal(deriveOrderStatus(['ACCEPTED', 'SHIPPED']), 'PROCESSING');
  assert.equal(deriveOrderStatus(['CANCELLED', 'IN_TRANSIT']), 'IN_TRANSIT');
  assert.equal(deriveOrderStatus(['DELIVERED', 'DELIVERED']), 'DELIVERED');
  assert.equal(deriveOrderStatus(['CANCELLED', 'CANCELLED']), 'CANCELLED');
  assert.equal(deriveOrderStatus(['RTO']), 'DELIVERY_FAILED');
  assert.equal(deriveOrderStatus(['RTO_DELIVERED', 'DELIVERED']), 'DELIVERED'); // returned parcels do not hold the order back
  assert.equal(deriveOrderStatus(['RTO_DELIVERED']), 'CANCELLED');
});

test('only parcels the seller has not made ready to ship can be cancelled; the seller has one next step at a time', () => {
  assert.deepEqual(['CONFIRMED', 'ACCEPTED', 'READY_TO_SHIP', 'SHIPPED'].map(isCancellable), [true, true, false, false]);
  assert.deepEqual(['CONFIRMED', 'ACCEPTED', 'READY_TO_SHIP'].map(nextActionOf), ['confirm', 'ready-to-ship', null]);
  assert.equal(stageOf('OUT_FOR_DELIVERY'), 'SHIPPED');
  assert.equal(stageOf('READY_TO_SHIP'), 'PROCESSING');
});

test('courier words map to ours; unknown ones move nothing', () => {
  assert.equal(mapShiprocketStatus('Picked Up'), 'SHIPPED');
  assert.equal(mapShiprocketStatus(' out for delivery '), 'OUT_FOR_DELIVERY');
  assert.equal(mapShiprocketStatus('RTO Initiated'), 'RTO');
  assert.equal(mapShiprocketStatus('RTO Delivered'), 'RTO_DELIVERED');
  assert.equal(mapShiprocketStatus('Pickup Scheduled'), null);
});

test('courier updates never go backwards, and delivered stays delivered', () => {
  assert.equal(canAdvance('READY_TO_SHIP', 'SHIPPED'), true);
  assert.equal(canAdvance('OUT_FOR_DELIVERY', 'IN_TRANSIT'), false); // a late, old scan
  assert.equal(canAdvance('OUT_FOR_DELIVERY', 'DELIVERY_FAILED'), true);
  assert.equal(canAdvance('DELIVERY_FAILED', 'OUT_FOR_DELIVERY'), true); // second attempt
  assert.equal(canAdvance('DELIVERED', 'RTO'), false);
  assert.equal(canAdvance('RTO', 'RTO_DELIVERED'), true);
  assert.equal(canAdvance('RTO', 'IN_TRANSIT'), false);
  assert.equal(canAdvance('RTO_DELIVERED', 'RTO'), false);
  assert.equal(canAdvance('SHIPPED', 'SHIPPED'), false);
  assert.equal(canAdvance('SHIPPED', null), false);
});

test('the return window runs from delivery, for the days the item was sold with', () => {
  const at = new Date('2026-11-22T10:00:00Z');
  const sub = { deliveredAt: at, events: [] };
  assert.equal(returnWindowEndsAt(sub, { returnWindowDays: 7 }).toISOString(), '2026-11-29T10:00:00.000Z');
  assert.equal(returnWindowEndsAt(sub, { returnWindowDays: 0 }), null); // no returns on this item
  assert.equal(returnWindowEndsAt(sub, {}), null); // sold before the policy was stored
  assert.equal(returnWindowEndsAt({ deliveredAt: null, events: [] }, { returnWindowDays: 7 }), null); // not delivered yet
  assert.equal(deliveredAtOf({ deliveredAt: null, events: [{ status: 'SHIPPED', at: 1 }, { status: 'DELIVERED', at }] }), at); // delivered before deliveredAt existed
});

test('the customer sees every step of a return up to the refund: done, current and still to come', () => {
  const ev = (...statuses) => statuses.map((status, i) => ({ status, at: new Date(Date.UTC(2026, 10, 23, i)) }));
  const states = (events) => journeyOf(events).map((step) => step.state[0]).join('');
  assert.equal(states(ev('REQUESTED')), 'CPPPPPPP'); // just asked: everything else is still to come
  assert.equal(states(ev('REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED')), 'DDCPPPPP');
  assert.equal(states(ev('REQUESTED', 'APPROVED', 'RECEIVED')), 'DDDDCPPP'); // received without a pickup scan: the skipped steps count as done
  assert.equal(states(ev('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_PASSED', 'REFUND_INITIATED')), 'DDDDDDCP');
  assert.equal(states(ev('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_PASSED', 'REFUND_COMPLETED')), 'DDDDDDDD'); // a refund that completed at once
  assert.equal(journeyOf(ev('REQUESTED', 'APPROVED'))[2].label, 'Pickup scheduled');
  assert.equal(journeyOf(ev('REQUESTED'))[1].label, 'Seller approval'); // a step to come is named for what will happen
  assert.equal(journeyOf(ev('REQUESTED', 'APPROVED'))[1].at, '2026-11-23T01:00:00.000Z');
  // ended early: what happened, ending in the failure, nothing still to come
  assert.deepEqual(journeyOf(ev('REQUESTED', 'REJECTED')).map((step) => [step.label, step.state]), [['Return requested', 'DONE'], ['Not approved', 'FAILED']]);
  assert.equal(states(ev('REQUESTED', 'APPROVED', 'RECEIVED', 'QC_FAILED')), 'DDDF');
});
