// Ensures every starter leaf category has two relevant, sellable products.
// Uses the real listing service for validation/counters and is safe to re-run.
// Usage: node scripts/seedProducts.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { attributeSetDetails } from '../src/modules/attribute/public/index.js';
import { Brand } from '../src/modules/catalog/infrastructure/persistence/brand.model.js';
import { Category } from '../src/modules/category/infrastructure/persistence/category.model.js';
import { Seller } from '../src/modules/identity/infrastructure/persistence/seller.model.js';
import { completeUpload, presignUpload, writeUploadBytes } from '../src/modules/media/application/media.service.js';
import { Media } from '../src/modules/media/infrastructure/persistence/media.model.js';
import { createListing } from '../src/modules/product/application/listing.service.js';
import { Offer } from '../src/modules/product/infrastructure/persistence/offer.model.js';
import { Product } from '../src/modules/product/infrastructure/persistence/product.model.js';
import { Variant } from '../src/modules/product/infrastructure/persistence/variant.model.js';
import {
  validateProductAttributeValues,
  validateVariantAttributeValues,
  validateVariantCombinations,
  variantDefiningCodes,
} from '../src/modules/product/domain/services/productRules.js';

const actor = { role: 'SYSTEM' };
const PLACEHOLDER_NAME = 'seed-product-placeholder.png';
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const PRODUCTS = {
  Shirts: [
    ['Oxford Cotton Formal Shirt', { fabric: 'Cotton', fit: 'Slim', sleeve_length: 'Full Sleeve', pattern: 'Solid' }, [{ colour: 'Blue', size: 'M' }, { colour: 'Blue', size: 'L' }], 149900],
    ['Linen Relaxed Summer Shirt', { fabric: 'Linen', fit: 'Relaxed', sleeve_length: 'Half Sleeve', pattern: 'Striped' }, [{ colour: 'White', size: 'L' }, { colour: 'Beige', size: 'XL' }], 179900],
  ],
  Shoes: [
    ['Urban Flex Walking Shoes', { upper_material: 'Mesh', sole_material: 'EVA', occasion: 'Casual' }, [{ shoe_size: 'UK-7' }, { shoe_size: 'UK-8' }], 249900, 'PUMA'],
    ['Classic Leather Derby Shoes', { upper_material: 'Leather', sole_material: 'Rubber', occasion: 'Formal' }, [{ shoe_size: 'UK-8' }, { shoe_size: 'UK-9' }], 329900],
  ],
  Dresses: [
    ['Floral Cotton Midi Dress', { fabric: 'Cotton', pattern: 'Floral', occasion: 'Casual' }, [{ colour: 'Blue', size: 'S' }, { colour: 'Blue', size: 'M' }], 219900],
    ['Silk Festive A-Line Dress', { fabric: 'Silk', pattern: 'Solid', occasion: 'Festive' }, [{ colour: 'Red', size: 'M' }, { colour: 'Green', size: 'L' }], 399900],
  ],
  Handbags: [
    ['Everyday Faux Leather Tote', { bag_material: 'Faux Leather', bag_type: 'Tote', closure: 'Zip', capacity_l: 18 }, [{ colour: 'Brown' }, { colour: 'Black' }], 189900],
    ['Canvas Crossbody Sling Bag', { bag_material: 'Canvas', bag_type: 'Sling Bag', closure: 'Magnetic', capacity_l: 8 }, [{ colour: 'Beige' }, { colour: 'Navy' }], 129900],
  ],
  Apple: [
    ['Apple iPhone 17', { screen_size: 6.3, battery_capacity: 3692, operating_system: 'iOS' }, [{ specs: '8/128', colour: 'Black' }, { specs: '8/256', colour: 'Blue' }], 7999900, 'Apple'],
    ['Apple iPhone 17 Air', { screen_size: 6.6, battery_capacity: 3149, operating_system: 'iOS' }, [{ specs: '8/128', colour: 'Gold' }, { specs: '8/256', colour: 'White' }], 8999900, 'Apple'],
  ],
  OnePlus: [
    ['OnePlus 15R', { screen_size: 6.78, battery_capacity: 6000, operating_system: 'Android' }, [{ specs: '8/256', colour: 'Black' }, { specs: '16/256', colour: 'Blue' }], 4999900, 'OnePlus'],
    ['OnePlus Open 2', { screen_size: 7.82, battery_capacity: 4800, operating_system: 'Android' }, [{ specs: '8/256', colour: 'Green' }, { specs: '16/256', colour: 'Black' }], 13999900, 'OnePlus'],
  ],
  'Gaming Laptops': [
    ['Ryzen 7 RTX Gaming Laptop', { processor: 'AMD Ryzen 7', screen_size: 15.6, operating_system: 'Windows' }, [{ colour: 'Black', ram: '16 GB', storage: '512 GB SSD' }, { colour: 'Black', ram: '32 GB', storage: '1 TB SSD' }], 8999900],
    ['Core i7 Performance Gaming Laptop', { processor: 'Intel Core i7', screen_size: 16, operating_system: 'Windows' }, [{ colour: 'Grey', ram: '16 GB', storage: '1 TB SSD' }, { colour: 'Grey', ram: '32 GB', storage: '1 TB SSD' }], 10999900],
  ],
  'Business Laptops': [
    ['Core i5 Professional Laptop', { processor: 'Intel Core i5', screen_size: 14, operating_system: 'Windows' }, [{ colour: 'Black', ram: '16 GB', storage: '512 GB SSD' }, { colour: 'Silver', ram: '16 GB', storage: '1 TB SSD' }], 6799900],
    ['Ryzen 5 Lightweight Business Laptop', { processor: 'AMD Ryzen 5', screen_size: 14, operating_system: 'Windows' }, [{ colour: 'Grey', ram: '8 GB', storage: '256 GB SSD' }, { colour: 'Grey', ram: '16 GB', storage: '512 GB SSD' }], 5499900],
  ],
  Cookware: [
    ['Hard Anodised Induction Kadhai', { cookware_material: 'Hard Anodised', cookware_type: 'Kadhai', capacity_l: 3, induction_compatible: true }, [], 189900],
    ['Cast Iron Frying Pan', { cookware_material: 'Cast Iron', cookware_type: 'Frying Pan', capacity_l: 2, induction_compatible: true }, [], 149900],
  ],
  Dinnerware: [
    ['Porcelain 18-Piece Dinner Set', { dinnerware_material: 'Porcelain', dinnerware_type: 'Dinner Set', set_pieces: 18, pattern: 'Floral', microwave_safe: true }, [], 299900],
    ['Stainless Steel Serving Bowl Set', { dinnerware_material: 'Stainless Steel', dinnerware_type: 'Serving Set', set_pieces: 6, pattern: 'Solid', microwave_safe: false }, [], 159900],
  ],
  Bedsheets: [
    ['300 TC Cotton Bedsheet Set', { fabric: 'Cotton', thread_count: 300, pattern: 'Printed' }, [{ bed_size: 'Queen', colour: 'Blue' }, { bed_size: 'King', colour: 'Blue' }], 179900],
    ['Linen Solid Bedsheet', { fabric: 'Linen', thread_count: 220, pattern: 'Solid' }, [{ bed_size: 'Double', colour: 'Beige' }, { bed_size: 'Queen', colour: 'Beige' }], 239900],
  ],
  Curtains: [
    ['Blackout Textured Window Curtains', { fabric: 'Polyester', pattern: 'Textured', blackout: true }, [{ curtain_size: '5 ft', colour: 'Grey' }, { curtain_size: '7 ft', colour: 'Grey' }], 129900],
    ['Printed Cotton Door Curtains', { fabric: 'Cotton', pattern: 'Printed', blackout: false }, [{ curtain_size: '7 ft', colour: 'Blue' }, { curtain_size: '9 ft', colour: 'Blue' }], 99900],
  ],
  'Face Makeup': [
    ['Longwear Matte Foundation', { face_makeup_type: 'Foundation', finish: 'Matte', coverage: 'Full', skin_type: 'All Skin Types' }, [{ shade: 'Ivory' }, { shade: 'Caramel' }], 89900],
    ['Natural Finish Compact Powder', { face_makeup_type: 'Compact', finish: 'Natural', coverage: 'Medium', skin_type: 'Oily' }, [{ shade: 'Beige' }, { shade: 'Honey' }], 64900],
  ],
  'Eye Makeup': [
    ['Waterproof Precision Kajal', { eye_makeup_type: 'Kajal', finish: 'Matte', waterproof: true }, [{ shade: 'Black' }, { shade: 'Brown' }], 34900],
    ['Shimmer Eye Shadow Stick', { eye_makeup_type: 'Eye Shadow', finish: 'Shimmer', waterproof: false }, [{ shade: 'Gold' }, { shade: 'Pink' }], 54900],
  ],
  'Face Care': [
    ['Hydrating Gel Moisturiser', { face_care_type: 'Moisturiser', skin_type: 'Dry', formulation: 'Gel', concern: 'Hydration', volume_ml: 100 }, [], 69900],
    ['SPF 50 Liquid Sunscreen', { face_care_type: 'Sunscreen', skin_type: 'All Skin Types', formulation: 'Liquid', concern: 'Sun Protection', volume_ml: 50 }, [], 79900],
  ],
  'Body Care': [
    ['Fresh Body Wash', { body_care_type: 'Body Wash', skin_type: 'All Skin Types', formulation: 'Gel', fragrance: 'Fresh', volume_ml: 250 }, [], 39900],
    ['Unscented Nourishing Body Lotion', { body_care_type: 'Body Lotion', skin_type: 'Sensitive', formulation: 'Lotion', fragrance: 'Unscented', volume_ml: 400 }, [], 64900],
  ],
  'Fitness Equipment': [
    ['20 kg Rubber Dumbbell Pair', { fitness_equipment_type: 'Dumbbell', max_user_weight: 20, fitness_material: 'Rubber', foldable: false }, [], 349900],
    ['Foldable Home Exercise Bike', { fitness_equipment_type: 'Exercise Bike', max_user_weight: 120, fitness_material: 'Steel', foldable: true }, [], 1299900],
  ],
  'Yoga Accessories': [
    ['Non-Slip TPE Yoga Mat', { yoga_product_type: 'Yoga Mat', yoga_material: 'TPE', thickness_mm: 6 }, [{ colour: 'Blue' }, { colour: 'Purple' }], 99900],
    ['Natural Cork Yoga Block', { yoga_product_type: 'Yoga Block', yoga_material: 'Cork', thickness_mm: 75 }, [{ colour: 'Brown' }, { colour: 'Beige' }], 59900],
  ],
  Cricket: [
    ['Kashmir Willow Cricket Bat', { cricket_equipment_type: 'Cricket Bat', cricket_material: 'Kashmir Willow', player_level: 'Intermediate', weight_g: 1180 }, [{ cricket_size: 'Harrow' }, { cricket_size: 'Full Size' }], 299900],
    ['Leather Practice Cricket Ball', { cricket_equipment_type: 'Cricket Ball', cricket_material: 'Leather', player_level: 'Advanced', weight_g: 156 }, [{ cricket_size: 'Size 5' }, { cricket_size: 'Size 6' }], 49900],
  ],
  Badminton: [
    ['Carbon Fibre Badminton Racket', { badminton_equipment_type: 'Badminton Racket', weight_class: '4U', badminton_material: 'Carbon Fibre', player_level: 'Advanced' }, [{ grip_size: 'G4' }, { grip_size: 'G5' }], 249900],
    ['Graphite Beginner Badminton Racket', { badminton_equipment_type: 'Badminton Racket', weight_class: '5U', badminton_material: 'Graphite', player_level: 'Beginner' }, [{ grip_size: 'G3' }, { grip_size: 'G4' }], 149900],
  ],
};

async function productImage(sellerId) {
  const existing = await Media.findOne({ ownerId: sellerId, kind: 'PRODUCT_IMAGE', status: 'READY', fileName: PLACEHOLDER_NAME }).lean();
  if (existing) return String(existing._id);
  const { uploadId } = await presignUpload({ ownerId: sellerId, role: 'SELLER', kind: 'PRODUCT_IMAGE', fileName: PLACEHOLDER_NAME, mimeType: 'image/png', sizeBytes: PLACEHOLDER_PNG.length });
  await writeUploadBytes({ uploadId, ownerId: sellerId, role: 'SELLER', buffer: PLACEHOLDER_PNG });
  await completeUpload({ uploadId, ownerId: sellerId, width: 1, height: 1 });
  return uploadId;
}

function listingBody(categoryId, imageId, brandId, categoryName, definition, sequence) {
  const [title, attributes, options, price, brandName] = definition;
  const code = `${categoryName}-${sequence}-${title}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 48).replace(/-$/, '');
  const common = { mrpPaise: Math.ceil(price * 1.15 / 100) * 100, sellingPricePaise: price, stock: 12, weightG: 500, dimsCm: { l: 30, w: 20, h: 10 } };
  return {
    title,
    categoryId,
    ...(brandId && brandName ? { brandId } : {}),
    description: `${title} selected for the ${categoryName} catalogue with category-specific specifications.`,
    highlights: ['Category-relevant specifications', 'Ready stock', 'Quality checked'],
    images: [imageId],
    attributes,
    manufacturer: `${brandName ?? 'Arise Select'} Manufacturing, India`,
    countryOfOrigin: 'India',
    fulfillmentType: 'SELLER',
    ...(options.length
      ? { variants: options.map((variantAttributes, index) => ({ ...common, attributes: variantAttributes, label: Object.values(variantAttributes).join(' · '), sku: `${code}-${index + 1}` })) }
      : { ...common, sku: `${code}-1` }),
  };
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const seller = await Seller.findOne({ storeName: 'indore Store', status: { $in: ['APPROVED', 'ACTIVE'] } }).lean()
    ?? await Seller.findOne({ status: { $in: ['APPROVED', 'ACTIVE'] } }).sort({ createdAt: 1 }).lean();
  assert(seller, 'An approved seller is required before seeding products');
  const sellerId = String(seller._id);
  const [imageId, categories, brands] = await Promise.all([
    productImage(sellerId),
    Category.find({ level: 3, status: 'ACTIVE' }).lean(),
    Brand.find({ status: 'VERIFIED' }).lean(),
  ]);
  assert.equal(categories.length, 20, 'Expected the 20 starter leaf categories');
  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const brandByName = new Map(brands.map((brand) => [brand.name, String(brand._id)]));
  let created = 0;

  const apple = categoryByName.get('Apple');
  const legacyIphone = await Product.findOne({ categoryId: apple._id, title: 'iPhone 18 Pro - Burgundy' }).lean();
  if (legacyIphone) {
    await Promise.all([
      Product.updateOne({ _id: legacyIphone._id }, { $set: { attributes: { screen_size: '6.3', battery_capacity: '3692', operating_system: 'iOS' } } }),
      Variant.updateMany({ productId: legacyIphone._id }, { $set: { 'attributes.colour': 'Burgundy' } }),
    ]);
  }

  for (const [categoryName, definitions] of Object.entries(PRODUCTS)) {
    const category = categoryByName.get(categoryName);
    assert(category, `Missing leaf category: ${categoryName}`);
    let count = await Product.countDocuments({ categoryId: category._id });
    for (const [sequence, definition] of definitions.entries()) {
      if (count >= 2) break;
      const [title, , , , brandName] = definition;
      if (await Product.exists({ categoryId: category._id, title })) continue;
      const brandId = brandName ? brandByName.get(brandName) : null;
      assert(!brandName || brandId, `Missing verified brand: ${brandName}`);
      const listing = await createListing(
        listingBody(String(category._id), imageId, brandId, categoryName, definition, sequence + 1),
        { sellerId, actor },
      );
      await Promise.all([
        Product.updateOne({ _id: listing.productId }, { $set: { status: 'LIVE', reviewReason: null } }),
        Offer.updateMany({ productId: listing.productId }, { $set: { status: 'LIVE', productStatus: 'LIVE', reviewReason: null } }),
      ]);
      count += 1;
      created += 1;
      console.log(`${categoryName}: ${title} (created)`);
    }
    assert.equal(count, 2, `${categoryName} must contain exactly two products after this seed`);
  }

  assert.equal(Object.keys(PRODUCTS).length, 20, 'Every starter leaf needs product definitions');
  const totals = await Promise.all(categories.map(async (category) => ({
    name: category.name,
    products: await Product.countDocuments({ categoryId: category._id }),
    live: await Product.countDocuments({ categoryId: category._id, status: 'LIVE' }),
  })));
  assert(totals.every(({ products, live }) => products === 2 && live === 2), 'Every leaf category must have two live products');
  const seededProducts = await Product.find({ categoryId: { $in: categories.map(({ _id }) => _id) } }, '_id').lean();
  const variantCounts = await Variant.aggregate([{ $match: { productId: { $in: seededProducts.map(({ _id }) => _id) } } }, { $group: { _id: '$productId', count: { $sum: 1 } } }]);
  assert.equal(variantCounts.length, seededProducts.length, 'Every product must have at least one sellable variant');
  for (const category of categories) {
    const { attributes: definitions } = await attributeSetDetails(category.attributeSetId, { activeOnly: true });
    const plain = definitions.filter(({ variantDefining }) => !variantDefining);
    const variantDefinitions = definitions.filter(({ variantDefining }) => variantDefining);
    for (const product of await Product.find({ categoryId: category._id }).lean()) {
      const variants = await Variant.find({ productId: product._id }).lean();
      assert.deepEqual(validateProductAttributeValues(product.attributes, plain).errors, {}, `${product.title} has invalid product attributes`);
      assert.deepEqual(validateVariantAttributeValues(variants, variantDefinitions), {}, `${product.title} has invalid variant values`);
      assert.deepEqual(validateVariantCombinations(variants, variantDefiningCodes(variantDefinitions)), {}, `${product.title} has invalid variant combinations`);
    }
  }
  console.log(`Seed complete: ${created} products created; ${seededProducts.length} products across 20 leaf categories verified.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
