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
    // Set by an admin: shows this campaign as a flash-sale banner on the customer home screen. Any number of campaigns may hold it at once.
    homeFlashSale: { type: Boolean, default: false },
    // Look of the campaign in the customer app (all optional; URLs of CMS_MEDIA uploads).
    backgroundImageUrl: { type: String, default: null }, // blended behind the gradient on its Deals card
    heroImageUrl: { type: String, default: null }, // hero of its own campaign page
    gradient: { type: [String], default: undefined }, // [top, bottom] hex colours of its Deals card and page
    createdBy: { type: String, required: true, immutable: true },
  },
  { collection: 'promoCampaigns', timestamps: true, versionKey: false },
);

campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ homeFlashSale: 1 });

export const Campaign = mongoose.models.Campaign ?? mongoose.model('Campaign', campaignSchema);
