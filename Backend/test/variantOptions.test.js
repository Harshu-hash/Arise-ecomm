// Variant choices a customer makes besides colour and size (e.g. "8/128" vs "8/256" phones).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
});
const { variantOptions } = await import('../src/modules/product/application/customerCatalog.service.js');

test('every variant-defining attribute besides colour and size becomes a choice', () => {
  const names = new Map([['specs', 'RAM/ROM']]);
  const variants = [
    { attributes: { specs: '8/128', colour: 'Red' } },
    { attributes: { specs: '8/256', colour: 'Red' } },
    { attributes: { specs: '8/128', colour: 'Blue' } },
  ];
  assert.deepEqual(variantOptions(variants, names), [{ code: 'specs', name: 'RAM/ROM', values: ['8/128', '8/256'] }]);
  assert.deepEqual(variantOptions([{ attributes: { specs: '8/128' } }], names), [], 'nothing to choose between');
  assert.deepEqual(variantOptions([{ attributes: { size: 'M' } }, { attributes: { size: 'L' } }], names), [], 'size has its own picker');
});
