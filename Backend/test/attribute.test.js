import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attributeCode,
  normalizeAttributeValues,
  validateAttributeShape,
} from '../src/modules/attribute/domain/services/attributeRules.js';

test('attribute values normalize duplicates and deactivate removed in-use options', () => {
  assert.equal(attributeCode('  Sleeve_Length '), 'sleeve_length');
  assert.deepEqual(
    normalizeAttributeValues([' Red ', 'red', 'Blue'], [{ value: 'Green', active: true, synonyms: ['Emerald'] }], true),
    [
      { value: 'Red', active: true, synonyms: [] },
      { value: 'Blue', active: true, synonyms: [] },
      { value: 'Green', active: false, synonyms: ['Emerald'] },
    ],
  );
});

test('attribute shape requires options and restricts variant types', () => {
  assert.deepEqual(validateAttributeShape({ type: 'SIZE', values: [], variantDefining: true }), {
    values: ['Add at least one value for this attribute type.'],
  });
  assert.deepEqual(validateAttributeShape({ type: 'TEXT', values: [], variantDefining: true }), {
    variantDefining: ['Only single-select, colour, and size attributes can define variants.'],
  });
});
