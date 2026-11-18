import assert from 'node:assert/strict';
import test from 'node:test';
import { sizeChartNameKey, validateSizeChartGrid } from '../src/modules/catalog/domain/services/sizeChartRules.js';

test('size chart names normalize and grids reject ambiguous headings and sizes', () => {
  assert.equal(sizeChartNameKey('  Men’s   Shirts  '), 'men’s shirts');
  assert.doesNotThrow(() => validateSizeChartGrid(['Size', 'Chest'], [['38', '40']]));
  assert.throws(() => validateSizeChartGrid(['Size', ' size '], [['38', '40']]), /unique/);
  assert.throws(() => validateSizeChartGrid(['Size', 'Chest'], [['38', '40'], [' 38 ', '41']]), /unique/);
  assert.throws(() => validateSizeChartGrid(['Size', 'Chest'], [['38']]), /one value per column/);
});
