import mongoose from 'mongoose';
import { AUDIENCE_TYPES, COUPON_FUNDERS, COUPON_STATE, COUPON_TYPES, COUPON_VISIBILITY } from '../../domain/constants/coupon.js';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, immutable: true }, // always upper-case
    name: { type: String, required: true },
    description: { type: String, default: '' },
    terms: { type: String, default: '' },
    type: { type: String, enum: COUPON_TYPES, required: true, immutable: true },
    valuePct: { type: Number, default: null },
    valuePaise: { type: Number, default: null },
    maxDiscountPaise: { type: Number, default: null },
    buyQty: { type: Number, default: null },
    getQty: { type: Number, default: null },
    minCartPaise: { type: Number, default: 0 },
    audience: {
      type: { type: String, enum: AUDIENCE_TYPES, default: 'ALL' },
      customerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    },
    fundedBy: { type: String, enum: COUPON_FUNDERS, default: 'ARISE' },
    // Set for a coupon a seller created (fundedBy SELLER): it applies only to that seller's items and only they manage it.
    sellerId: { type: String, default: null, immutable: true },
    stackable: { type: Boolean, default: false },
    visibility: { type: String, enum: COUPON_VISIBILITY, default: 'PUBLIC' },
    totalLimit: { type: Number, required: true },
    perUserLimit: { type: Number, required: true },
    budgetPaise: { type: Number, required: true },
    // Counters are advanced only by checkout (not built yet); the admin API never writes them.
    totalRedemptions: { type: Number, default: 0 },
    budgetUsedPaise: { type: Number, default: 0 },
    state: { type: String, enum: Object.values(COUPON_STATE), default: COUPON_STATE.LIVE },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    createdBy: { type: String, required: true, immutable: true },
  },
  { collection: 'coupons', timestamps: true, versionKey: false },
);

couponSchema.index({ createdAt: -1 });
couponSchema.index({ state: 1, endsAt: 1, _id: 1 }); // the customer list: live coupons, soonest-ending first, no in-memory sort
couponSchema.index({ sellerId: 1, createdAt: -1 }, { sparse: true }); // a seller's own list

export const Coupon = mongoose.models.Coupon ?? mongoose.model('Coupon', couponSchema);
