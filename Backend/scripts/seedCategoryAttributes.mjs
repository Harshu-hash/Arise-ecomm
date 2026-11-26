// Seeds category attributes and attaches one relevant set to every starter leaf category.
// Non-destructive and re-runnable. Usage: node scripts/seedCategoryAttributes.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import {
  createAttribute,
  createAttributeSet,
  updateAttribute,
  updateAttributeSet,
} from '../src/modules/attribute/application/attribute.service.js';
import { attributeNameKey } from '../src/modules/attribute/domain/services/attributeRules.js';
import { Attribute } from '../src/modules/attribute/infrastructure/persistence/attribute.model.js';
import { AttributeSet } from '../src/modules/attribute/infrastructure/persistence/attributeSet.model.js';
import { updateCategory } from '../src/modules/category/application/category.service.js';
import { categoryNameKey } from '../src/modules/category/domain/services/categoryRules.js';
import { Category } from '../src/modules/category/infrastructure/persistence/category.model.js';

const actor = { role: 'SYSTEM' };
const select = (name, values, extra = {}) => ({ name, type: 'SINGLE_SELECT', values, filterable: true, variantDefining: false, ...extra });
const number = (name, unit = null) => ({ name, type: 'NUMBER', unit, values: [], filterable: true, variantDefining: false });
const bool = (name) => ({ name, type: 'BOOLEAN', values: [], filterable: true, variantDefining: false });
const variant = (name, type, values) => ({ name, type, values, filterable: true, variantDefining: true });

const ATTRIBUTES = {
  colour: variant('Colour', 'COLOUR', ['Black', 'White', 'Red', 'Burgundy', 'Blue', 'Green', 'Grey', 'Brown', 'Beige', 'Pink', 'Navy', 'Yellow', 'Purple', 'Gold', 'Silver']),
  size: variant('Size', 'SIZE', ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']),
  shoe_size: variant('Shoe Size', 'SIZE', ['UK-5', 'UK-6', 'UK-7', 'UK-8', 'UK-9', 'UK-10', 'UK-11', 'UK-12']),
  fabric: select('Fabric', ['Cotton', 'Linen', 'Polyester', 'Silk', 'Wool', 'Denim', 'Synthetic']),
  pattern: select('Pattern', ['Solid', 'Printed', 'Striped', 'Checked', 'Floral', 'Textured']),
  fit: select('Fit', ['Regular', 'Slim', 'Relaxed', 'Oversized']),
  sleeve_length: select('Sleeve Length', ['Full Sleeve', 'Half Sleeve', 'Short Sleeve', 'Sleeveless']),
  occasion: select('Occasion', ['Casual', 'Formal', 'Party', 'Sports', 'Festive']),
  bag_material: select('Bag Material', ['Leather', 'Faux Leather', 'Canvas', 'Nylon', 'Synthetic']),
  bag_type: select('Bag Type', ['Tote', 'Shoulder Bag', 'Sling Bag', 'Backpack', 'Clutch']),
  closure: select('Closure', ['Zip', 'Magnetic', 'Buckle', 'Drawstring', 'Open']),
  capacity_l: number('Capacity', 'L'),
  upper_material: select('Upper Material', ['Mesh', 'Leather', 'Synthetic', 'Canvas', 'Knit']),
  sole_material: select('Sole Material', ['Rubber', 'EVA', 'PU', 'TPR']),
  screen_size: number('Screen Size', 'inch'),
  battery_capacity: number('Battery Capacity', 'mAh'),
  operating_system: select('Operating System', ['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'No OS']),
  ram: variant('RAM', 'SINGLE_SELECT', ['8 GB', '16 GB', '32 GB', '64 GB']),
  storage: variant('Storage', 'SINGLE_SELECT', ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD']),
  processor: select('Processor', ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'Apple M2', 'Apple M3', 'Apple M4']),
  cookware_type: select('Cookware Type', ['Frying Pan', 'Kadhai', 'Saucepan', 'Pressure Cooker', 'Cookware Set']),
  cookware_material: select('Cookware Material', ['Stainless Steel', 'Aluminium', 'Cast Iron', 'Hard Anodised', 'Ceramic']),
  induction_compatible: bool('Induction Compatible'),
  dinnerware_type: select('Dinnerware Type', ['Dinner Set', 'Plates', 'Bowls', 'Mugs', 'Serving Set']),
  dinnerware_material: select('Dinnerware Material', ['Ceramic', 'Porcelain', 'Glass', 'Stainless Steel', 'Melamine']),
  set_pieces: number('Number of Pieces'),
  microwave_safe: bool('Microwave Safe'),
  bed_size: variant('Bed Size', 'SIZE', ['Single', 'Double', 'Queen', 'King']),
  thread_count: number('Thread Count'),
  curtain_size: variant('Curtain Length', 'SIZE', ['5 ft', '7 ft', '9 ft']),
  blackout: bool('Blackout'),
  shade: variant('Shade', 'COLOUR', ['Ivory', 'Beige', 'Natural', 'Honey', 'Caramel', 'Brown', 'Black', 'Blue', 'Green', 'Pink', 'Red', 'Gold']),
  finish: select('Finish', ['Matte', 'Natural', 'Dewy', 'Glossy', 'Shimmer']),
  coverage: select('Coverage', ['Light', 'Medium', 'Full']),
  skin_type: select('Skin Type', ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive', 'All Skin Types']),
  face_makeup_type: select('Face Makeup Type', ['Foundation', 'Concealer', 'Blush', 'Primer', 'Compact']),
  eye_makeup_type: select('Eye Makeup Type', ['Kajal', 'Eyeliner', 'Mascara', 'Eye Shadow', 'Brow Product']),
  face_care_type: select('Face Care Type', ['Cleanser', 'Moisturiser', 'Serum', 'Sunscreen', 'Face Mask']),
  body_care_type: select('Body Care Type', ['Body Lotion', 'Body Wash', 'Body Scrub', 'Body Oil', 'Hand Cream']),
  waterproof: bool('Waterproof'),
  formulation: select('Formulation', ['Cream', 'Gel', 'Liquid', 'Powder', 'Oil', 'Lotion', 'Foam']),
  concern: select('Concern', ['Hydration', 'Acne', 'Brightening', 'Anti-ageing', 'Sun Protection', 'Pigmentation']),
  volume_ml: number('Volume', 'ml'),
  fragrance: select('Fragrance', ['Unscented', 'Floral', 'Fresh', 'Fruity', 'Woody']),
  fitness_equipment_type: select('Fitness Equipment Type', ['Treadmill', 'Exercise Bike', 'Dumbbell', 'Bench', 'Resistance Band']),
  fitness_material: select('Equipment Material', ['Steel', 'Cast Iron', 'Rubber', 'Plastic', 'Foam']),
  max_user_weight: number('Maximum User Weight', 'kg'),
  foldable: bool('Foldable'),
  thickness_mm: number('Thickness', 'mm'),
  yoga_product_type: select('Yoga Product Type', ['Yoga Mat', 'Yoga Block', 'Yoga Strap', 'Bolster', 'Foam Roller']),
  yoga_material: select('Yoga Material', ['TPE', 'Natural Rubber', 'PVC', 'Cork', 'Foam', 'Cotton']),
  cricket_size: variant('Cricket Size', 'SINGLE_SELECT', ['Size 3', 'Size 4', 'Size 5', 'Size 6', 'Harrow', 'Full Size']),
  cricket_equipment_type: select('Cricket Equipment Type', ['Cricket Bat', 'Cricket Ball', 'Batting Gloves', 'Helmet', 'Protective Pads']),
  cricket_material: select('Cricket Material', ['English Willow', 'Kashmir Willow', 'Leather', 'Synthetic', 'Wood']),
  player_level: select('Player Level', ['Beginner', 'Intermediate', 'Advanced', 'Professional']),
  weight_g: number('Weight', 'g'),
  grip_size: variant('Grip Size', 'SINGLE_SELECT', ['G2', 'G3', 'G4', 'G5']),
  badminton_equipment_type: select('Badminton Equipment Type', ['Badminton Racket', 'Shuttlecock', 'Net', 'Grip', 'Kit Bag']),
  badminton_material: select('Badminton Material', ['Graphite', 'Carbon Fibre', 'Aluminium', 'Steel', 'Nylon']),
  weight_class: select('Weight Class', ['2U', '3U', '4U', '5U', '6U']),
};

const SETS = [
  ['Shirts', 'Fashion', ['colour', 'size', 'fabric', 'fit', 'sleeve_length', 'pattern']],
  ['Dresses', 'Fashion', ['colour', 'size', 'fabric', 'pattern', 'occasion']],
  ['Handbags', 'Fashion', ['colour', 'bag_material', 'bag_type', 'closure', 'capacity_l']],
  ['Footwear', 'Fashion', ['shoe_size', 'upper_material', 'sole_material', 'occasion'], ['Shoes']],
  ['Mobiles', 'Electronics', ['screen_size', 'battery_capacity', 'operating_system'], ['Apple', 'OnePlus']],
  ['Laptops', 'Electronics', ['colour', 'ram', 'storage', 'processor', 'screen_size', 'operating_system'], ['Gaming Laptops', 'Business Laptops']],
  ['Cookware', 'Home & Kitchen', ['cookware_material', 'cookware_type', 'capacity_l', 'induction_compatible']],
  ['Dinnerware', 'Home & Kitchen', ['dinnerware_material', 'dinnerware_type', 'set_pieces', 'pattern', 'microwave_safe']],
  ['Bedsheets', 'Home & Kitchen', ['bed_size', 'colour', 'fabric', 'thread_count', 'pattern']],
  ['Curtains', 'Home & Kitchen', ['curtain_size', 'colour', 'fabric', 'pattern', 'blackout']],
  ['Face Makeup', 'Beauty & Personal Care', ['shade', 'face_makeup_type', 'finish', 'coverage', 'skin_type']],
  ['Eye Makeup', 'Beauty & Personal Care', ['shade', 'eye_makeup_type', 'finish', 'waterproof']],
  ['Face Care', 'Beauty & Personal Care', ['face_care_type', 'skin_type', 'formulation', 'concern', 'volume_ml']],
  ['Body Care', 'Beauty & Personal Care', ['body_care_type', 'skin_type', 'formulation', 'fragrance', 'volume_ml']],
  ['Fitness Equipment', 'Sports & Fitness', ['fitness_equipment_type', 'max_user_weight', 'fitness_material', 'foldable']],
  ['Yoga Accessories', 'Sports & Fitness', ['yoga_product_type', 'yoga_material', 'colour', 'thickness_mm']],
  ['Cricket', 'Sports & Fitness', ['cricket_equipment_type', 'cricket_size', 'cricket_material', 'player_level', 'weight_g']],
  ['Badminton', 'Sports & Fitness', ['badminton_equipment_type', 'grip_size', 'weight_class', 'badminton_material', 'player_level']],
];

async function ensureAttribute(code, definition) {
  const existing = await Attribute.findOne({ code }).lean();
  if (!existing) return createAttribute({ code, ...definition }, actor);
  assert.equal(existing.type, definition.type, `${code} already has a different type`);
  assert.equal(existing.variantDefining, definition.variantDefining, `${code} already has different variant behaviour`);
  const existingValues = existing.values.map((value) => value.value);
  const values = [...existingValues, ...definition.values.filter((value) => !existingValues.some((item) => item.toLocaleLowerCase('en-IN') === value.toLocaleLowerCase('en-IN')))];
  if (values.length !== existingValues.length || (definition.filterable && !existing.filterable)) {
    return updateAttribute(existing._id, { version: existing.version, values, filterable: existing.filterable || definition.filterable }, actor);
  }
  return { id: String(existing._id) };
}

async function ensureSet(name, rootName, codes, attributeIds) {
  const ids = codes.map((code) => attributeIds.get(code));
  let set = await AttributeSet.findOne({ nameKey: attributeNameKey(name) }).lean();
  if (!set) return createAttributeSet({ name, rootName, attributeIds: ids }, actor);
  const current = new Set(set.attributeIds.map(String));
  const exact = set.rootName && (ids.length !== current.size || ids.some((id) => !current.has(id)));
  if (exact) {
    for (const category of await Category.find({ attributeSetId: set._id }).lean()) {
      await updateCategory(category._id, { version: category.version, attributeSetId: null }, { scope: null, actor });
    }
    set = await AttributeSet.findById(set._id).lean();
    return updateAttributeSet(set._id, { version: set.version, attributeIds: ids }, actor);
  }
  const added = ids.filter((id) => !current.has(id));
  if (added.length) return updateAttributeSet(set._id, { version: set.version, attributeIds: [...current, ...added] }, actor);
  return { id: String(set._id) };
}

async function attach(categoryName, setId) {
  const category = await Category.findOne({ level: 3, nameKey: categoryNameKey(categoryName) }).lean();
  assert(category, `Missing leaf category: ${categoryName}`);
  if (category.attributeSetId) {
    assert.equal(String(category.attributeSetId), setId, `${categoryName} already uses another attribute set`);
    return;
  }
  await updateCategory(category._id, { version: category.version, attributeSetId: setId }, { scope: null, actor });
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  await Promise.all([Attribute.init(), AttributeSet.init(), Category.init()]);

  const attributeIds = new Map();
  for (const [code, definition] of Object.entries(ATTRIBUTES)) {
    const attribute = await ensureAttribute(code, definition);
    attributeIds.set(code, attribute.id);
  }

  for (const [setName, rootName, codes, categories = [setName]] of SETS) {
    const set = await ensureSet(setName, rootName, codes, attributeIds);
    for (const categoryName of categories) await attach(categoryName, set.id);
  }

  const leaves = await Category.find({ level: 3 }, 'name attributeSetId').lean();
  assert.equal(leaves.length, 20, 'Expected the 20 starter leaf categories');
  assert(leaves.every((leaf) => leaf.attributeSetId), 'Every starter leaf category must have an attribute set');
  const sets = await AttributeSet.find().lean();
  for (const set of sets) {
    assert.equal(set.usedInCategories, await Category.countDocuments({ attributeSetId: set._id }), `${set.name} usage counter is out of sync`);
  }
  for (const attribute of await Attribute.find().lean()) {
    const expected = sets
      .filter((set) => set.attributeIds.some((attributeId) => String(attributeId) === String(attribute._id)))
      .reduce((total, set) => total + set.usedInCategories, 0);
    assert.equal(attribute.usedInCategories, expected, `${attribute.code} usage counter is out of sync`);
  }
  console.log(`Seed complete: ${await Attribute.countDocuments()} attributes, ${await AttributeSet.countDocuments()} sets, ${leaves.length} attached leaf categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
