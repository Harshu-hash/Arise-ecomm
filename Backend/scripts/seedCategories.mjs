// Seeds the starter three-level customer taxonomy through the real category service.
// Non-destructive and re-runnable: existing siblings are kept. Usage: node scripts/seedCategories.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { listCategoryTabs } from '../src/modules/admin/application/homeLayout.service.js';
import { createCategory } from '../src/modules/category/application/category.service.js';
import { categoryNameKey } from '../src/modules/category/domain/services/categoryRules.js';
import { Category } from '../src/modules/category/infrastructure/persistence/category.model.js';

const TAXONOMY = [
  ['Fashion', [
    ['Mens', ['Shirts', 'Shoes']],
    ['Womens', ['Dresses', 'Handbags']],
  ]],
  ['Electronics', [
    ['Mobiles', ['Apple', 'OnePlus']],
    ['Laptops', ['Gaming Laptops', 'Business Laptops']],
  ]],
  ['Home & Kitchen', [
    ['Kitchen & Dining', ['Cookware', 'Dinnerware']],
    ['Home Furnishing', ['Bedsheets', 'Curtains']],
  ]],
  ['Beauty & Personal Care', [
    ['Makeup', ['Face Makeup', 'Eye Makeup']],
    ['Skin Care', ['Face Care', 'Body Care']],
  ]],
  ['Sports & Fitness', [
    ['Exercise & Fitness', ['Fitness Equipment', 'Yoga Accessories']],
    ['Outdoor Sports', ['Cricket', 'Badminton']],
  ]],
];

const actor = { role: 'SYSTEM' };
const seededIds = [];
const rootIds = [];

async function ensureCategory(name, parent = null) {
  const parentId = parent?.id ?? null;
  const existing = await Category.findOne({ parentId, nameKey: categoryNameKey(name) }).lean();
  if (existing) {
    assert.equal(existing.level, (parent?.level ?? 0) + 1, `${name} has the wrong level`);
    assert.equal(String(existing.rootId), parent?.rootId ?? String(existing._id), `${name} has the wrong root`);
    console.log(`${'  '.repeat(existing.level - 1)}${name} (kept)`);
    seededIds.push(existing._id);
    return { id: String(existing._id), rootId: String(existing.rootId), level: existing.level };
  }

  const created = await createCategory(
    { name, ...(parentId ? { parentId } : {}) },
    { scope: null, actor },
  );
  seededIds.push(created.id);
  console.log(`${'  '.repeat(created.level - 1)}${name} (created)`);
  return { id: created.id, rootId: parent?.rootId ?? created.id, level: created.level };
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  await Category.init();

  for (const [rootName, mainCategories] of TAXONOMY) {
    const root = await ensureCategory(rootName);
    rootIds.push(root.id);
    for (const [mainName, subCategories] of mainCategories) {
      const main = await ensureCategory(mainName, root);
      for (const subName of subCategories) await ensureCategory(subName, main);
    }
  }

  const tabs = await listCategoryTabs();
  const rows = await Category.find({ _id: { $in: seededIds }, status: 'ACTIVE' }, 'level').lean();
  assert.deepEqual(
    [1, 2, 3].map((level) => rows.filter((row) => row.level === level).length),
    [5, 10, 20],
    'Expected exactly 5 header, 10 main, and 20 subcategories',
  );
  assert(rootIds.every((rootId) => tabs.some((tab) => tab.active && tab.categoryId === rootId)), 'Expected every seeded root in the active header tabs');
  console.log(`Seed complete: ${rows.length} starter categories and ${rootIds.length} header roots verified.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
