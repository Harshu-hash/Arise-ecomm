import mongoose from 'mongoose';

// What the customer last saw for a line: shows a listing that has since been removed, and lets the cart notice a price change.
const snapshotSchema = new mongoose.Schema(
  {
    productId: String,
    variantId: String,
    name: String,
    brand: String,
    category: String,
    imageUrl: String,
    variantLabel: String,
    sellerId: String,
    sellerName: String,
    mrpPaise: Number,
    unitPricePaise: Number,
  },
  { _id: false },
);

// One offer (a seller's variant) once per cart, either in it or saved for later; the line's _id is the cart item id.
const lineSchema = new mongoose.Schema(
  {
    offerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, min: 1, required: true },
    savedForLater: { type: Boolean, default: false },
    snapshot: { type: snapshotSchema, default: undefined },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// Only what the customer chose is stored. Prices, stock and totals are worked out fresh on every read.
// `version` moves on every change; a write made from an older view is retried rather than overwriting a newer one.
const cartSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, immutable: true },
    items: { type: [lineSchema], default: [] },
    couponCode: { type: String, default: null },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'customer_carts', timestamps: true, versionKey: false },
);

export const Cart = mongoose.models.Cart ?? mongoose.model('Cart', cartSchema);
