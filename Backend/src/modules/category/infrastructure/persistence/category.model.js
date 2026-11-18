import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, immutable: false, select: false },
    slug: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    rootId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    level: { type: Number, enum: [1, 2, 3], required: true, immutable: true },
    sortOrder: { type: Number, min: 1, required: true },
    status: { type: String, enum: ['ACTIVE', 'HIDDEN'], default: 'ACTIVE' },
    returnWindowDays: { type: Number, min: 0, max: 60, default: 7 },
    returnTypes: { type: [String], enum: ['REFUND', 'REPLACEMENT'], default: ['REFUND', 'REPLACEMENT'] },
    gated: { type: Boolean, default: false },
    codAllowed: { type: Boolean, default: true },
    gstRate: { type: Number, enum: [0, 5, 12, 18, 28], default: 18 },
    hsnCode: { type: String, trim: true, maxlength: 20, default: null },
    attributeSetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    imageUrl: { type: String, trim: true, maxlength: 2048, default: null },
    icon: { type: String, trim: true, maxlength: 64, default: null },
    color: { type: String, default: null },
    liveListings: { type: Number, min: 0, default: 0 },
    productCount: { type: Number, min: 0, default: 0 },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'categories', timestamps: true, versionKey: false },
);

categorySchema.index({ parentId: 1, nameKey: 1 }, { unique: true, name: 'category_sibling_name_unique' });
categorySchema.index({ parentId: 1, sortOrder: 1, _id: 1 });
categorySchema.index({ rootId: 1, level: 1, status: 1 });

export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
