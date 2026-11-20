// Seeds sample marketing + content data (coupons, deals, home layout, tabs, policy pages) through the real services,
// so every rule the API enforces is exercised. Non-destructive and re-runnable: anything that already exists is kept.
// Usage: node scripts/seedMarketingCms.mjs
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { cloneCoupon, createCoupon, endCoupon, togglePauseCoupon } from '../src/modules/coupon/application/coupon.service.js';
import { createDeal } from '../src/modules/coupon/application/deal.service.js';
import { Coupon } from '../src/modules/coupon/infrastructure/persistence/coupon.model.js';
import { Deal } from '../src/modules/coupon/infrastructure/persistence/deal.model.js';
import { istDate } from '../src/modules/coupon/domain/services/dealRules.js';
import { listBrandTabs, listCategoryTabs, publishHome, updateDraft } from '../src/modules/admin/application/homeLayout.service.js';
import { listPages, publishPage } from '../src/modules/admin/application/staticPage.service.js';
import { HomeLayoutVersion } from '../src/modules/admin/infrastructure/persistence/homeLayout.models.js';
import { getShelfPrices } from '../src/modules/product/public/index.js';
import { Product } from '../src/modules/product/infrastructure/persistence/product.model.js';
import { User } from '../src/modules/identity/infrastructure/persistence/user.model.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(Date.now() + days * DAY);
const log = (what, result) => console.log(what.padEnd(34), result);

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
await Promise.all([Coupon.init(), Deal.init(), HomeLayoutVersion.init()]); // the unique slot/code indexes must exist

const admin = await User.findOne({ role: 'ADMIN', permissions: '*' }, '_id').lean();
if (!admin) throw new Error('No super admin found. Run scripts/seedAdmin.mjs first.');
const actor = { userId: String(admin._id), role: 'ADMIN' };

// Runs one seed step; a rule violation or "already there" is reported, never fatal.
async function step(what, work) {
  try {
    log(what, (await work()) ?? 'created');
  } catch (error) {
    log(what, `skipped — ${Object.values(error.fieldErrors ?? {}).flat()[0] ?? error.message}`);
  }
}

/* ------------------------------------------------------------------ coupons */
const customer = await User.findOne({ role: 'CUSTOMER', status: 'ACTIVE' }, '_id').lean();
const base = { description: '', terms: 'One use per customer. Cannot be combined with other coupons.', startsAt: at(0), endsAt: at(30), totalLimit: 1000, perUserLimit: 1, minCartPaise: 0 };
const coupons = [
  { ...base, code: 'WELCOME10', name: '10% off your first order', type: 'PERCENT', valuePct: 10, maxDiscountPaise: 10_000, audience: { type: 'NEW' }, budgetPaise: 5_000_000 },
  { ...base, code: 'FLAT100', name: '₹100 off orders above ₹999', type: 'FLAT', valuePaise: 10_000, minCartPaise: 99_900, perUserLimit: 2, budgetPaise: 2_000_000 },
  { ...base, code: 'FREESHIP', name: 'Free delivery above ₹499', type: 'FREE_DELIVERY', minCartPaise: 49_900, perUserLimit: 5, budgetPaise: 1_000_000, visibility: 'HIDDEN' },
  { ...base, code: 'BUY2GET1', name: 'Buy 2, get 1 free', type: 'BXGY', buyQty: 2, getQty: 1, totalLimit: 200, budgetPaise: 3_000_000 },
  { ...base, code: 'FESTIVE20', name: '20% off — festive sale', type: 'PERCENT', valuePct: 20, maxDiscountPaise: 50_000, startsAt: at(7), endsAt: at(21), budgetPaise: 10_000_000, stackable: false },
  ...(customer ? [{ ...base, code: 'VIP25', name: 'VIP: 25% off', type: 'PERCENT', valuePct: 25, maxDiscountPaise: 100_000, audience: { type: 'CUSTOM', customerIds: [String(customer._id)] }, budgetPaise: 1_000_000, totalLimit: 50 }] : []),
];
for (const input of coupons) {
  await step(`coupon ${input.code}`, async () => {
    if (await Coupon.exists({ code: input.code })) return 'already exists';
    await createCoupon({ fundedBy: 'ARISE', stackable: false, visibility: 'PUBLIC', audience: { type: 'ALL' }, maxDiscountPaise: null, ...input }, actor);
  });
}
// One of each lifecycle state, so every tab on the Coupons page has something to show.
await step('coupon FREESHIP → paused', async () => {
  const row = await Coupon.findOne({ code: 'FREESHIP' }).lean();
  if (!row || row.state !== 'LIVE') return 'left as is';
  await togglePauseCoupon(row._id, actor);
  return 'FREESHIP paused';
});
await step('coupon clone (draft)', async () => {
  const source = await Coupon.findOne({ code: 'WELCOME10' }).lean();
  if (!source || (await Coupon.exists({ code: 'WELCOME10-2' }))) return 'already exists';
  await cloneCoupon(source._id, actor);
});
await step('coupon LAUNCH5 (ended)', async () => {
  if (await Coupon.exists({ code: 'LAUNCH5' })) return 'already exists';
  const made = await createCoupon({ ...base, code: 'LAUNCH5', name: '₹50 off launch offer', type: 'FLAT', valuePaise: 5_000, fundedBy: 'ARISE', stackable: false, visibility: 'PUBLIC', audience: { type: 'ALL' }, budgetPaise: 500_000, endsAt: at(10) }, actor);
  await endCoupon(made.id, actor);
});

/* -------------------------------------------------------------------- deals */
const products = await Product.find({ status: 'LIVE' }, 'title').limit(3).lean();
const shelf = await getShelfPrices(products.map((product) => String(product._id)));
const dealPlan = [
  { placement: 'OFFERS_PAGE', tag: 'BESTSELLER', label: 'Min. 15% Off', slot: istDate(at(1)), pct: 0.85 },
  { placement: 'TOP_VALUE_DEALS', tag: 'HOT DEAL', label: 'Top value pick', slot: istDate(at(2)), pct: 0.8 },
  { placement: 'OFFERS_PAGE', tag: 'TRENDING', label: 'Trending now', slot: null, pct: 0.9 },
];
for (const product of products) {
  const price = shelf.get(String(product._id));
  if (!price) continue;
  for (const [index, plan] of dealPlan.entries()) {
    await step(`deal ${product.title.slice(0, 18)} #${index + 1}`, async () => {
      if (await Deal.exists({ productId: product._id, placement: plan.placement, tag: plan.tag })) return 'already exists';
      await createDeal({
        title: product.title.slice(0, 80), label: plan.label, tag: plan.tag, productId: String(product._id), placement: plan.placement,
        dealPricePaise: Math.max(100, Math.floor(price.pricePaise * plan.pct)), slotDate: plan.slot, startsAt: new Date(), endsAt: at(14),
      }, actor);
    });
  }
}
if (!products.length) log('deals', 'skipped — no LIVE products yet');

/* --------------------------------------------------------- home layout + tabs */
const section = (type, enabled = true, config = {}) => ({ type, config, visibility: { enabled } });
await step('home layout draft', async () => {
  await updateDraft([
    section('HERO_BANNER_CAROUSEL'),
    section('RECENTLY_VIEWED_RAIL', true, { maxItems: 10 }),
    section('AD_TILE_ROW'),
    section('FLASH_SALE_BANNER'),
    section('SUGGESTED_FOR_YOU', true, { maxItems: 10 }),
    section('TOP_VALUE_DEALS'),
    section('BRANDS_SPOTLIGHT', true, { maxItems: 3 }),
    section('PRODUCT_FEED'),
    section('SPONSORED_RAIL', false),
    section('AD_SHEET_CARD', false),
  ], actor);
  return 'saved';
});
await step('home layout publish', async () => {
  if (await HomeLayoutVersion.exists({ slot: 'PUBLISHED' })) return 'already published';
  await publishHome({ note: 'Initial layout' }, actor);
  return 'published';
});
await step('category tabs', async () => `${(await listCategoryTabs()).length} tabs`);
await step('brand tabs', async () => `${(await listBrandTabs()).length} tabs`);

/* ------------------------------------------------------------- policy pages */
// Starter wording so the pages are not empty; legal text must be reviewed before launch.
const POLICY = {
  about: 'Arise is a marketplace where verified sellers across India list quality products at fair prices. We check every seller and every listing before it reaches you, and we stand behind each order.',
  'privacy-policy': 'We collect only the details needed to run your account and deliver your orders: name, contact details, addresses and order history. We never sell personal data. You can ask us to export or delete your data from the app at any time.',
  terms: 'By using Arise you agree to use the marketplace lawfully, to give accurate details, and to pay for what you order. Sellers are responsible for their listings; Arise mediates disputes and may suspend accounts that break these terms.',
  'return-policy': 'Eligible products can be returned within the window shown on the product page if they are unused and in original packaging. Refunds go to the original payment method after the item passes quality check.',
  'shipping-policy': 'Orders are shipped by the seller or by Arise fulfilment. Delivery estimates are shown at checkout and tracking is available in the app once your order ships.',
  'seller-policy': 'Sellers must list only genuine products they can supply, keep stock and prices current, ship within the promised time, and honour Arise return rules. Repeated violations lead to suspension.',
};
for (const page of await listPages()) {
  await step(`page ${page.slug}`, async () => {
    if (page.status === 'PUBLISHED' || !POLICY[page.slug]) return 'left as is';
    await publishPage(page.id, { body: POLICY[page.slug], materialChange: false, note: 'Starter text' }, actor);
  });
}

console.log('\nTotals — coupons:', await Coupon.countDocuments(), 'deals:', await Deal.countDocuments(), 'layout versions:', await HomeLayoutVersion.countDocuments());
await mongoose.disconnect();
