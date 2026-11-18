import mongoose from 'mongoose';
import { SUBMISSION_STATUS } from '../../domain/constants/campaign.js';

// A seller's product entry into a campaign. It reaches customers only once an admin APPROVES it.
// Created by the seller-side nomination flow; the admin API only reads and decides.
const submissionSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    sellerName: { type: String, required: true },
    productId: { type: String, required: true, immutable: true },
    productTitle: { type: String, required: true },
    brand: { type: String, default: null },
    imageUrl: { type: String, default: null },
    mrpPaise: { type: Number, required: true },
    dealPricePaise: { type: Number, required: true },
    discountPct: { type: Number, required: true },
    stockCommitted: { type: Number, required: true },
    status: { type: String, enum: Object.values(SUBMISSION_STATUS), default: SUBMISSION_STATUS.PENDING },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewerId: { type: String, default: null },
    reviewer: { type: String, default: null },
    rejectionReason: { type: String, default: null },
  },
  { collection: 'promoCampaignSubmissions', timestamps: true, versionKey: false },
);

// One entry per product per campaign; also serves the per-campaign status tabs.
submissionSchema.index({ campaignId: 1, productId: 1 }, { unique: true });
submissionSchema.index({ campaignId: 1, status: 1, submittedAt: -1 });

export const CampaignSubmission =
  mongoose.models.CampaignSubmission ?? mongoose.model('CampaignSubmission', submissionSchema);
