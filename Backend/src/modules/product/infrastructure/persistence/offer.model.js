import mongoose from 'mongoose';

// The seller's sellable instance of a variant: price, stock, fulfilment — the part of
// "catalog product vs seller offer" (ARCHITECTURE.md §4) that is genuinely per-seller.
// Buy-box selection and Arise Assured are a separate, not-yet-built feature; every offer
// here is honestly `buyBoxWinner: false` until that module exists, never guessed.
const offerSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // No standalone index: the unique compound below already covers variantId-only lookups.
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Variant', required: true },
    sellerId: { type: String, required: true, index: true },
    sellerSku: { type: String, trim: true, maxlength: 64, default: null },
    sellingPricePaise: { type: Number, min: 0, required: true },
    mrpPaise: { type: Number, min: 0, required: true },
    taxCode: { type: String, trim: true, maxlength: 20, default: null },
    stock: { type: Number, min: 0, default: 0 },
    fulfillmentType: { type: String, enum: ['SELLER', 'ARISE'], default: 'SELLER' },
    status: { type: String, enum: ['DRAFT', 'QC_PENDING', 'LIVE', 'NEEDS_CHANGES', 'REJECTED', 'INACTIVE'], default: 'QC_PENDING' },
    buyBoxWinner: { type: Boolean, default: false },
    ariseAssured: { type: Boolean, default: false },
    // Snapshot from the product/variant at creation time, so the seller's own listings
    // list can search/sort/filter on the Offer collection alone — no join per row. Nothing
    // yet changes a product after creation (no QC/edit flow exists), so this cannot drift;
    // once one does, that flow must update these alongside the Product it changes.
    productTitle: { type: String, default: null },
    productImage: { type: String, default: null },
    brandName: { type: String, default: null },
    categoryPath: { type: String, default: null },
    variantLabel: { type: String, default: null },
    sku: { type: String, default: null },
    productStatus: { type: String, default: null },
    reviewReason: { type: String, trim: true, maxlength: 1000, default: null },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'offers', timestamps: true, versionKey: false },
);

// One seller may hold at most one offer per variant.
offerSchema.index({ variantId: 1, sellerId: 1 }, { unique: true, name: 'offer_variant_seller_unique' });
offerSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export const Offer = mongoose.models.Offer ?? mongoose.model('Offer', offerSchema);
