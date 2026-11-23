// Pure-logic tests for the seller wallet rules (no database needed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLine, holdReasonOf, lineStateOf, withdrawableOf, withdrawalProblem } from '../src/modules/settlement/domain/settlementRules.js';

const rates = { closingFeePaise: 0, collectionFeePct: 0, gstOnFeesPct: 18, tcsPct: 0.5, tdsPct: 0.1 };

test('line money: fees, GST on fees, TCS and TDS on the taxable value come out of the sale', () => {
  const line = computeLine({ salePaise: 20_000, gstPaise: 2_143, commissionPaise: 2_000, rates });
  assert.deepEqual([line.feesBeforeTaxPaise, line.gstOnFeesPaise, line.tcsPaise, line.tdsPaise, line.netPaise, line.negative], [2_000, 360, 89, 18, 17_533, false]);
  assert.equal(20_000 - line.feesBeforeTaxPaise - line.gstOnFeesPaise - line.tcsPaise - line.tdsPaise, line.netPaise);
});

test('line money: closing and collection fees count, and a net below zero is shown, not clamped', () => {
  const line = computeLine({ salePaise: 1_000, gstPaise: 0, commissionPaise: 100, rates: { ...rates, closingFeePaise: 1_500, collectionFeePct: 2 } });
  assert.equal(line.feesBeforeTaxPaise, 100 + 1_500 + 20);
  assert.equal(line.negative, true);
  assert.ok(line.netPaise < 0);
});

test('line state: reversed, released, held by a return or unremitted cash, else pending', () => {
  assert.equal(lineStateOf({ reversedAt: new Date(), releasedAt: new Date() }), 'REVERSED');
  assert.equal(lineStateOf({ releasedAt: new Date() }, { returnOpen: true }), 'AVAILABLE'); // already released: a return no longer holds it
  assert.equal(lineStateOf({}, { returnOpen: true }), 'HELD');
  assert.equal(lineStateOf({ codPending: true, codRemittedAt: null }), 'HELD');
  assert.equal(lineStateOf({ codPending: true, codRemittedAt: new Date() }), 'PENDING');
  assert.equal(holdReasonOf({ codPending: true }), 'Cash on delivery: waiting for the courier to remit the cash');
  assert.equal(holdReasonOf({}), null);
});

test('withdrawable: a new seller keeps a reserve, a negative balance withdraws nothing', () => {
  assert.deepEqual(withdrawableOf(7_533, 10), { reservePaise: 754, withdrawablePaise: 6_779 });
  assert.deepEqual(withdrawableOf(7_533, 0), { reservePaise: 0, withdrawablePaise: 7_533 });
  assert.deepEqual(withdrawableOf(-500, 10), { reservePaise: 0, withdrawablePaise: 0 });
});

test('withdrawal request: the admin limits and the balance decide, first problem wins', () => {
  const limits = { minWithdrawalPaise: 1_000, maxWithdrawalPaise: 50_000, dailyWithdrawalLimitPaise: 60_000, maxOpenWithdrawals: 1 };
  const ask = (over) => withdrawalProblem({ amountPaise: 10_000, withdrawablePaise: 100_000, limits, requestedTodayPaise: 0, openCount: 0, ...over })?.[0] ?? null;
  assert.equal(ask({}), null);
  assert.equal(ask({ amountPaise: 0 }), 'AMOUNT_INVALID');
  assert.equal(ask({ amountPaise: 500 }), 'BELOW_MINIMUM');
  assert.equal(ask({ amountPaise: 50_001 }), 'ABOVE_MAXIMUM');
  assert.equal(ask({ openCount: 1 }), 'TOO_MANY_OPEN');
  assert.equal(ask({ requestedTodayPaise: 55_000 }), 'DAILY_LIMIT');
  assert.equal(ask({ withdrawablePaise: 9_999 }), 'INSUFFICIENT_BALANCE');
  assert.equal(withdrawalProblem({ amountPaise: 40_000, withdrawablePaise: 100_000, limits: { ...limits, dailyWithdrawalLimitPaise: 0 }, requestedTodayPaise: 900_000, openCount: 0 }), null); // 0 = no daily limit
});
