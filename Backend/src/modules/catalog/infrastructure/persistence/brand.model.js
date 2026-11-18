import mongoose from 'mongoose';
import { BRAND_OWNER_TYPES, BRAND_STATUSES } from '../../domain/services/brandRules.js';

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, select: false },
    imageUrl: { type: String, trim: true, maxlength: 2048, default: null },
    rootCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    rootCategory: { type: String, trim: true, maxlength: 100, default: null },
    status: { type: String, enum: BRAND_STATUSES, default: 'PENDING', index: true },
    ownerType: { type: String, enum: BRAND_OWNER_TYPES, default: 'BRAND_OWNER' },
    gated: { type: Boolean, default: false },
    productCount: { type: Number, min: 0, default: 0 },
    listingCount: { type: Number, min: 0, default: 0 },
    authorisedSellerCount: { type: Number, min: 0, default: 0 },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'brands', timestamps: true, versionKey: false },
);

brandSchema.index({ nameKey: 1 }, { unique: true, name: 'brand_name_unique' });
brandSchema.index({ status: 1, name: 1, _id: 1 });
brandSchema.index({ rootCategoryId: 1, status: 1, name: 1 });

export const Brand = mongoose.models.Brand ?? mongoose.model('Brand', brandSchema);
