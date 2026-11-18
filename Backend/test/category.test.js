import assert from 'node:assert/strict';
import test from 'node:test';
import {
  categoryNameKey,
  categorySlug,
  categoryTree,
  inheritedCategoryValues,
} from '../src/modules/category/domain/services/categoryRules.js';

test('category names normalize for sibling uniqueness without losing Unicode slugs', () => {
  assert.equal(categoryNameKey('  Men   Clothing  '), 'men clothing');
  assert.equal(categorySlug('Men & Clothing'), 'men-clothing');
  assert.equal(categorySlug('घर और रसोई'), 'घर-और-रसोई');
});

test('new children inherit every policy and zero return windows clear return types', () => {
  const parent = {
    returnWindowDays: 14,
    returnTypes: ['REFUND'],
    gated: true,
    codAllowed: false,
    gstRate: 5,
    hsnCode: '6205',
    attributeSetId: 'abc',
  };
  assert.deepEqual(inheritedCategoryValues(parent, {}), parent);
  assert.deepEqual(inheritedCategoryValues(parent, { returnWindowDays: 0 }).returnTypes, []);
});

test('category tree sorts siblings and nests all three levels', () => {
  const rows = [
    { _id: 'root', parentId: null, name: 'Fashion', sortOrder: 1 },
    { _id: 'women', parentId: 'root', name: 'Women', sortOrder: 2 },
    { _id: 'men', parentId: 'root', name: 'Men', sortOrder: 1 },
    { _id: 'shirts', parentId: 'men', name: 'Shirts', sortOrder: 1 },
  ];
  const tree = categoryTree(rows, (row) => ({ id: row._id, name: row.name }));
  assert.equal(tree[0].children[0].name, 'Men');
  assert.equal(tree[0].children[0].children[0].name, 'Shirts');
  assert.equal(tree[0].children[1].name, 'Women');
});
