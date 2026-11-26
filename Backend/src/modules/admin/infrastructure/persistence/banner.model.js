import mongoose from 'mongoose';
import { BANNER_KINDS, BANNER_PLACEMENTS } from '../../domain/constants/banner.js';

const bannerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: BANNER_KINDS, required: true },
    // URLs of files uploaded through the CMS_MEDIA upload purpose.
    images: {
      mobile_16_9: { type: String, default: '' },
      tile_1_1: { type: String, default: '' },
      web: { type: String, default: '' },
    },
    // A hero banner is an image or a video, never both (the service checks); '' for the one not used.
    videoUrl: { type: String, default: '' },
    altText: { type: String, required: true },
    placements: { type: [{ type: String, enum: BANNER_PLACEMENTS }], required: true },
    // Categories whose page shows this banner; only meaningful with the CATEGORY_HERO placement.
    categoryIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    priority: { type: Number, required: true }, // lower shows first
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    // Written by the customer-app tracking pipeline, never by the admin API.
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    createdBy: { type: String, required: true, immutable: true },
  },
  { collection: 'banners', timestamps: true, versionKey: false },
);

bannerSchema.index({ priority: 1 });
bannerSchema.index({ startsAt: 1, endsAt: 1 });

export const Banner = mongoose.models.Banner ?? mongoose.model('Banner', bannerSchema);
