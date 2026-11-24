import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKey, deltaPct, fillDays, fulfilmentFunnel, pct, rangeDays, startOfDay, windows } from '../src/modules/analytics/domain/services/analyticsRules.js';

test('days are Indian days: 23:00 UTC is already tomorrow in IST', () => {
  assert.equal(dayKey(new Date('2026-11-23T23:00:00Z')), '2026-11-24');
  assert.equal(startOfDay('2026-11-24').toISOString(), '2026-11-23T18:30:00.000Z');
});

test('windows: the last N days and the N before them, oldest first', () => {
  const w = windows(3, new Date('2026-11-24T10:00:00Z'));
  assert.deepEqual(w.current, ['2026-11-22', '2026-11-23', '2026-11-24']);
  assert.deepEqual(w.previous, ['2026-11-19', '2026-11-20', '2026-11-21']);
  assert.deepEqual(rangeDays('2026-11-30', '2026-12-02'), ['2026-11-30', '2026-12-01', '2026-12-02']);
  assert.equal(rangeDays('2020-01-01', '2026-01-01').length, 366, 'a huge range is capped');
});

test('quiet days are zero, ratios guard against dividing by nothing', () => {
  const rows = new Map([['2026-11-23', { orders: 2 }]]);
  assert.deepEqual(fillDays(['2026-11-22', '2026-11-23'], rows, { orders: 0, gmvPaise: 0 }), [
    { date: '2026-11-22', orders: 0, gmvPaise: 0 },
    { date: '2026-11-23', orders: 2, gmvPaise: 0 },
  ]);
  assert.equal(pct(1, 0), 0);
  assert.equal(pct(1, 3), 33.33);
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(5, 0), null);
});

test('the fulfilment funnel counts parcels at or past each stage', () => {
  const funnel = fulfilmentFunnel({ CONFIRMED: 2, ACCEPTED: 1, SHIPPED: 1, DELIVERED: 3, CANCELLED: 1 });
  assert.deepEqual(funnel.map((s) => s.count), [8, 5, 4, 4, 3]);
});
