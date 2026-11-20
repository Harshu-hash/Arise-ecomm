import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVariantSpecs,
  generateSku,
  nextStatusForDecision,
  validatePricing,
  validateProductAttributeValues,
  validateVariantAttributeValues,
  validateVariantCombinations,
  variantDefiningCodes,
} from '../src/modules/product/domain/services/productRules.js';

test('buildVariantSpecs reads either the variants array or the simple-product fields, never both', () => {
  const simple = buildVariantSpecs({ mrpPaise: 1000, sellingPricePaise: 800, stock: 5, barcode: '123' });
  assert.equal(simple.length, 1);
  assert.deepEqual(simple[0].attributes, {});
  assert.equal(simple[0].barcode, '123');

  const withVariants = buildVariantSpecs({
    variants: [{ attributes: { colour: 'Red' }, mrpPaise: 500, sellingPricePaise: 400 }],
    mrpPaise: 999, // ignored once variants[] is present
  });
  assert.equal(withVariants.length, 1);
  assert.equal(withVariants[0].mrpPaise, 500);
});

test('validatePricing requires MRP/price only when not a draft, and rejects price above MRP', () => {
  const specs = buildVariantSpecs({});
  assert.deepEqual(Object.keys(validatePricing(specs, true)), []); // draft: nothing required
  const missing = validatePricing(specs, false);
  assert.ok(missing.mrpPaise && missing.sellingPricePaise);

  const overpriced = buildVariantSpecs({ mrpPaise: 100, sellingPricePaise: 200 });
  assert.ok(validatePricing(overpriced, false).sellingPricePaise[0].includes('cannot exceed MRP'));
});

test('variant combinations must cover every variant-defining attribute and never repeat', () => {
  const variantDefs = [{ code: 'colour', variantDefining: true }, { code: 'size', variantDefining: true }];
  const codes = variantDefiningCodes(variantDefs);
  assert.deepEqual(codes, ['colour', 'size']);

  const incomplete = [{ attributes: { colour: 'Red' } }];
  assert.ok(validateVariantCombinations(incomplete, codes).variants[0].includes('missing'));

  const duplicate = [
    { attributes: { colour: 'Red', size: 'M' } },
    { attributes: { colour: 'Red', size: 'M' } },
  ];
  assert.ok(validateVariantCombinations(duplicate, codes).variants[0].includes('duplicates'));

  const valid = [
    { attributes: { colour: 'Red', size: 'M' } },
    { attributes: { colour: 'Red', size: 'L' } },
  ];
  assert.deepEqual(validateVariantCombinations(valid, codes), {});
});

test('variant attribute values must be one of the category catalog\'s active options', () => {
  const variantDefs = [{ code: 'colour', name: 'Colour', values: [{ value: 'Red', active: true }, { value: 'Blue', active: false }] }];
  assert.deepEqual(
    validateVariantAttributeValues([{ attributes: { colour: 'Red' } }], variantDefs),
    {},
  );
  assert.ok(validateVariantAttributeValues([{ attributes: { colour: 'Blue' } }], variantDefs).variants); // inactive
  assert.ok(validateVariantAttributeValues([{ attributes: { fabric: 'Cotton' } }], variantDefs).variants); // unknown code
});

test('product attribute values are trimmed, type-checked, and rejected if unknown or out of range', () => {
  const plainDefs = [
    { code: 'fabric', name: 'Fabric', type: 'SINGLE_SELECT', values: [{ value: 'Cotton', active: true }] },
    { code: 'battery_life', name: 'Battery Life', type: 'NUMBER', values: [] },
  ];
  const ok = validateProductAttributeValues({ fabric: ' Cotton ', battery_life: '12' }, plainDefs);
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.clean, { fabric: 'Cotton', battery_life: '12' });

  assert.ok(validateProductAttributeValues({ fabric: 'Wool' }, plainDefs).errors.attributes); // not in option list
  assert.ok(validateProductAttributeValues({ battery_life: 'lots' }, plainDefs).errors.attributes); // not a number
  assert.ok(validateProductAttributeValues({ unknown: 'x' }, plainDefs).errors.attributes); // not a category attribute
});

test('nextStatusForDecision maps each admin action to its target status, and rejects unknown actions', () => {
  assert.equal(nextStatusForDecision('approve'), 'LIVE');
  assert.equal(nextStatusForDecision('reject'), 'REJECTED');
  assert.equal(nextStatusForDecision('request-changes'), 'NEEDS_CHANGES');
  assert.equal(nextStatusForDecision('archive'), null);
});

test('generateSku prefers a custom SKU, otherwise derives one from brand and product id', () => {
  assert.equal(generateSku({ custom: 'my-sku', productId: 'p1', index: 0 }), 'MY-SKU');
  assert.equal(generateSku({ brandName: 'Nova', productId: 'p1', index: 2 }), 'NOVA-p1-3');
  assert.equal(generateSku({ productId: 'p1', index: 0 }), 'SKU-p1-1');
});

test('customer price is the cheapest in-stock live offer, falling back to out-of-stock ones', async () => {
  const { bestOffer } = await import('../src/modules/product/application/customerCatalog.service.js');
  const offers = [
    { sellingPricePaise: 900, stock: 0 },
    { sellingPricePaise: 1500, stock: 5 },
    { sellingPricePaise: 1300, stock: 2 },
  ];
  assert.equal(bestOffer(offers).sellingPricePaise, 1300);
  assert.equal(bestOffer([offers[0]]).sellingPricePaise, 900);
});
