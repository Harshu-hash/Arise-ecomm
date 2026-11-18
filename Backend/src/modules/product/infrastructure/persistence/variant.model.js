import mongoose from 'mongoose';

const dimsSchema = new mongoose.Schema(
  { l: { type: Number, min: 1, required: true }, w: { type: Number, min: 1, required: true }, h: { type: Number, min: 1, required: true } },
  { _id: false },
);

// One SKU per sellable variant (a colour/size combination, or the product itself
// when the category has no variant-defining attributes).
const variantSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, trim: true, maxlength: 64 },
    ean: { type: String, trim: true, maxlength: 32, default: null },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    label: { type: String, trim: true, maxlength: 200, default: null },
    images: { type: [String], default: [] },
    weightG: { type: Number, min: 1, required: true },
    dimsCm: { type: dimsSchema, required: true },
    status: { type: String, enum: ['ACTIVE'], default: 'ACTIVE' },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'variants', timestamps: true, versionKey: false },
);

variantSchema.index({ sku: 1 }, { unique: true, name: 'variant_sku_unique' });
variantSchema.index({ productId: 1 });

export const Variant = mongoose.models.Variant ?? mongoose.model('Variant', variantSchema);
