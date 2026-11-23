import assert from 'node:assert/strict';
import test from 'node:test';
import { financialYear, isIntraState, taxLine, totalsOf } from '../src/modules/order/domain/services/invoiceRules.js';

test('GST splits into CGST+SGST inside a state and IGST across states, always adding up', () => {
  const intra = taxLine({ description: 'x', paidPaise: 11_800, gstRate: 18, intra: true });
  assert.deepEqual([intra.taxablePaise, intra.cgstPaise, intra.sgstPaise, intra.igstPaise], [10_000, 900, 900, 0]);
  const odd = taxLine({ description: 'x', paidPaise: 105, gstRate: 5, intra: true }); // 5 paise of GST: no paise is lost
  assert.equal(odd.cgstPaise + odd.sgstPaise, 5);
  const inter = taxLine({ description: 'x', paidPaise: 11_800, gstRate: 18, intra: false });
  assert.deepEqual([inter.cgstPaise, inter.sgstPaise, inter.igstPaise], [0, 0, 1_800]);
  assert.equal(totalsOf([intra, inter]).totalPaise, 23_600);
});

test('state match ignores case and blanks; a missing state is never "same state"', () => {
  assert.equal(isIntraState(' karnataka', 'Karnataka'), true);
  assert.equal(isIntraState('Karnataka', 'Kerala'), false);
  assert.equal(isIntraState(null, null), false);
});

test('financial year runs April to March in IST', () => {
  assert.equal(financialYear(new Date('2026-03-31T12:00:00Z')), '2025-26');
  assert.equal(financialYear(new Date('2026-03-31T19:00:00Z')), '2026-27'); // already 1 April in India
  assert.equal(financialYear(new Date('2026-11-22T00:00:00Z')), '2026-27');
});
