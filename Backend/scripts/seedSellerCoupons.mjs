// Seeds 8 sample coupons for one seller through the real service (so every rule is exercised), covering every status.
// Non-destructive and re-runnable: a code that already exists is kept.
// Usage: node scripts/seedSellerCoupons.mjs [sellerId]   (default: the seller that owns a LIVE product)
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { createCoupon, endCoupon, setCouponPaused } from '../src/modules/coupon/application/coupon.service.js';
import { SELLER_COUPON_BUDGET_PAISE } from '../src/modules/coupon/domain/constants/coupon.js';
import { Coupon } from '../src/modules/coupon/infrastructure/persistence/coupon.model.js';
import { Product } from '../src/modules/product/infrastructure/persistence/product.model.js';
import { User } from '../src/modules/identity/infrastructure/persistence/user.model.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(Date.now() + days * DAY);

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
await Coupon.init();
const sellerId = process.argv[2] ?? (await Product.findOne({ status: 'LIVE' }, 'createdBySellerId').lean())?.createdBySellerId;
if (!sellerId) throw new Error('No seller given and no LIVE product to pick one from.');
const owner = await User.findOne({ sellerId, role: 'SELLER' }, '_id').lean();
if (!owner) throw new Error(`Seller ${sellerId} has no owner account.`);
const actor = { userId: String(owner._id), role: 'SELLER', sellerId };

const common = { description: '', maxDiscountPaise: null, minCartPaise: 0, perUserLimit: 1, startsAt: at(0), endsAt: at(30) };
const plan = [
  { code: 'INDORE10', name: '10% off your first order', type: 'PERCENT', valuePct: 10, maxDiscountPaise: 20_000, minCartPaise: 49_900, totalLimit: 1000, description: 'Welcome offer for new customers.' },
  { code: 'FLAT150', name: '₹150 off orders above ₹999', type: 'FLAT', valuePaise: 15_000, minCartPaise: 99_900, perUserLimit: 2, totalLimit: 500 },
  { code: 'SHIPFREE', name: 'Free delivery, no minimum', type: 'FREE_DELIVERY', perUserLimit: 3, totalLimit: 2000, description: 'Weekend shipping treat.' },
  { code: 'EARLY300', name: 'Flat ₹300 off for early shoppers', type: 'FLAT', valuePaise: 30_000, minCartPaise: 199_900, totalLimit: 300, endsAt: at(45) },
  { code: 'WEEKEND20', name: '20% off this weekend', type: 'PERCENT', valuePct: 20, maxDiscountPaise: 50_000, totalLimit: 400, startsAt: at(3), endsAt: at(5) },
  { code: 'FESTIVE25', name: '25% off festive range', type: 'PERCENT', valuePct: 25, maxDiscountPaise: 75_000, minCartPaise: 149_900, totalLimit: 800, after: 'pause' },
  { code: 'DIWALI25', name: '25% off Diwali special', type: 'PERCENT', valuePct: 25, maxDiscountPaise: 50_000, totalLimit: 600, after: 'end' },
  { code: 'FLASH50', name: '₹50 off — flash offer', type: 'FLAT', valuePaise: 5_000, totalLimit: 50, after: 'exhaust' },
];

for (const { after, ...input } of plan) {
  try {
    if (await Coupon.exists({ code: input.code })) { console.log(input.code.padEnd(10), 'already exists'); continue; }
    const made = await createCoupon({
      ...common, ...input, sellerId, fundedBy: 'SELLER', audience: { type: 'ALL' }, stackable: false, visibility: 'PUBLIC', terms: '', budgetPaise: SELLER_COUPON_BUDGET_PAISE,
    }, actor);
    if (after === 'pause') await setCouponPaused(made.id, true, actor, sellerId);
    if (after === 'end') await endCoupon(made.id, actor, sellerId);
    // Sample "fully used" coupon: checkout (not built yet) will advance these counters for real.
    if (after === 'exhaust') await Coupon.updateOne({ _id: made.id }, { $set: { totalRedemptions: input.totalLimit, budgetUsedPaise: input.totalLimit * input.valuePaise } });
    console.log(input.code.padEnd(10), after ? `created, then ${after}` : 'created');
  } catch (error) {
    console.log(input.code.padEnd(10), `skipped — ${Object.values(error.fieldErrors ?? {}).flat()[0] ?? error.message}`);
  }
}
console.log(`\nseller ${sellerId} now has`, await Coupon.countDocuments({ sellerId }), 'coupons');
await mongoose.disconnect();
process.exit(0);
