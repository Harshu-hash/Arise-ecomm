import mongoose from 'mongoose';
import { DEAL_PLACEMENTS, DEAL_TAGS } from '../../domain/constants/coupon.js';

// A deal is "a live product's offer, discounted further" for one of the app's rails.
const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    label: { type: String, default: '' },
    tag: { type: String, enum: DEAL_TAGS, default: 'TRENDING' },
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sellerId: { type: String, required: true },
    // The shelf MRP when the deal was made: the strike-through price on the rail.
    mrpPaise: { type: Number, required: true },
    dealPricePaise: { type: Number, required: true },
    placement: { type: String, enum: DEAL_PLACEMENTS, required: true },
    // "Deal of the Day" calendar day (YYYY-MM-DD, India), at most one deal per placement per day.
    slotDate: { type: String, default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    createdBy: { type: String, required: true, immutable: true },
  },
  { collection: 'deals', timestamps: true, versionKey: false },
);

// The database itself guarantees one deal per slot, even if two admins pick the same day at once.
dealSchema.index(
  { placement: 1, slotDate: 1 },
  { unique: true, partialFilterExpression: { slotDate: { $type: 'string' } }, name: 'one_deal_per_slot' },
);
dealSchema.index({ startsAt: -1 });

export const Deal = mongoose.models.Deal ?? mongoose.model('Deal', dealSchema);
