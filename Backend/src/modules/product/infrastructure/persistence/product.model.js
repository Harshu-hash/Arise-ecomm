import mongoose from 'mongoose';

// Catalog product is distinct from a seller's offer/listing on it (ARCHITECTURE.md §4):
// this document is the shared catalog entity; price/stock/fulfilment live on Offer.
//
// Status is intentionally narrow: only what the create flow in this module produces.
// LIVE/NEEDS_CHANGES/REJECTED/ARCHIVED belong to the admin QC-review module when it lands.
const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null, index: true },
    brandName: { type: String, trim: true, maxlength: 100, default: null },
    // No standalone index: the `{ categoryId, status }` compound below covers categoryId-only lookups too.
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    categoryPath: { type: String, trim: true, maxlength: 300, default: null },
    rootCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    status: { type: String, enum: ['DRAFT', 'QC_PENDING'], default: 'QC_PENDING', index: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    highlights: { type: [String], default: [] },
    // Plain (non-variant-defining) category attribute values, e.g. { fabric: 'Cotton' }.
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Rendered verbatim by the customer product page.
    fit: { type: String, trim: true, maxlength: 100, default: null },
    care: { type: String, trim: true, maxlength: 500, default: null },
    modelInfo: { type: String, trim: true, maxlength: 200, default: null },
    manufacturer: { type: String, trim: true, maxlength: 200, default: null },
    countryOfOrigin: { type: String, trim: true, maxlength: 100, default: 'India' },
    productCode: { type: String, trim: true, maxlength: 64, default: null },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    complianceDocuments: { type: [String], default: [] },
    // Snapshot from the category at creation time, so a later category edit never
    // silently changes an already-created product's tax/return terms.
    hsnCode: { type: String, trim: true, maxlength: 20, default: null },
    gstRate: { type: Number, min: 0, max: 28, default: 18 },
    sizeChartId: { type: mongoose.Schema.Types.ObjectId, ref: 'SizeChart', default: null },
    returnPolicy: {
      windowDays: { type: Number, min: 0, max: 60, default: 7 },
      type: { type: String, enum: ['RETURN', 'REPLACEMENT', 'NONE'], default: 'RETURN' },
    },
    // No standalone index: the `{ createdBySellerId, createdAt }` compound below covers this too.
    createdBySellerId: { type: String, required: true },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'products', timestamps: true, versionKey: false },
);

productSchema.index({ createdBySellerId: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ title: 'text' });

export const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);
