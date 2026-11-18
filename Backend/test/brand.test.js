import assert from 'node:assert/strict';
import test from 'node:test';
import { brandNameKey } from '../src/modules/catalog/domain/services/brandRules.js';

test('brand names normalize Unicode, case and whitespace for uniqueness', () => {
  assert.equal(brandNameKey('  Allen   Solly  '), 'allen solly');
  assert.equal(brandNameKey('ＡＲＩＳＥ'), 'arise');
});
