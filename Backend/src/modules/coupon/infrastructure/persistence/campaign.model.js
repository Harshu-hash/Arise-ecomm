import mongoose from 'mongoose';
import { CAMPAIGN_STATUS, CAMPAIGN_TYPES, CUSTOMER_SECTIONS } from '../../domain/constants/campaign.js';

// A promotional campaign (flash deal / offer / sale) that sellers nominate products into.
// Entry counters are derived from submissions at read time, so they can never drift.
const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: CAMPAIGN_TYPES, required: true },
    status: { type: String, enum: Object.values(CAMPAIGN_STATUS), default: CAMPAIGN_STATUS.DRAFT },
    customerSection: { type: String, enum: CUSTOMER_SECTIONS, required: true },
    tagline: { type: String, default: '' },
    minDiscountPct: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    submissionDeadline: { type: Date, default: null },
    createdBy: { type: String, required: true, immutable: true },
  },
  { collection: 'promoCampaigns', timestamps: true, versionKey: false },
);

campaignSchema.index({ status: 1, createdAt: -1 });

export const Campaign = mongoose.models.Campaign ?? mongoose.model('Campaign', campaignSchema);
