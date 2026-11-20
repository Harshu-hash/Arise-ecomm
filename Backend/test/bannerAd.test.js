import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOKING_STATUS, bannerAdPrice, displayStatus, enumerateDays, todayIst } from '../src/modules/bannerAd/domain/bannerAdRules.js';

test('enumerateDays lists every day inclusively and rejects bad or backwards ranges', () => {
  assert.deepEqual(enumerateDays('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.deepEqual(enumerateDays('2026-05-01', '2026-05-01'), ['2026-05-01']);
  assert.equal(enumerateDays('2026-05-02', '2026-05-01'), null);
  assert.equal(enumerateDays('2026-02-31', '2026-03-02'), null);
  assert.equal(enumerateDays('nope', '2026-03-02'), null);
});

test('price is days x daily rate plus 18% GST, in whole paise', () => {
  assert.deepEqual(bannerAdPrice({ days: 3, dailyRatePaise: 150_000 }), {
    days: 3, dailyRatePaise: 150_000, subtotalPaise: 450_000, gstPct: 18, gstPaise: 81_000, totalPaise: 531_000,
  });
  assert.equal(bannerAdPrice({ days: 1, dailyRatePaise: 333 }).gstPaise, 60); // 59.94 rounds to 60
});

test('approved bookings follow their dates; every other status is shown as stored', () => {
  const booking = { startsOn: '2026-06-10', endsOn: '2026-06-12' };
  const approved = { ...booking, status: BOOKING_STATUS.APPROVED };
  assert.equal(displayStatus(approved, '2026-06-09'), 'SCHEDULED');
  assert.equal(displayStatus(approved, '2026-06-11'), 'LIVE');
  assert.equal(displayStatus(approved, '2026-06-13'), 'COMPLETED');
  assert.equal(displayStatus({ ...booking, status: BOOKING_STATUS.PENDING_REVIEW }, '2026-06-11'), 'PENDING_REVIEW');
});

test('today is the India calendar day, not UTC', () => {
  assert.equal(todayIst(new Date('2026-01-01T19:00:00Z')), '2026-01-02'); // 00:30 IST next day
  assert.equal(todayIst(new Date('2026-01-01T10:00:00Z')), '2026-01-01');
});
