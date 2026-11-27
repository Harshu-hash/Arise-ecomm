import mongoose from 'mongoose';

// One product a customer saved. Kept even while the product is off the shelf, so it comes back if relisted.
const wishlistItemSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    productId: { type: String, required: true, immutable: true },
    addedAt: { type: Date, required: true, immutable: true },
    // what the price/stock alerts last saw (null until the first scan), so only a change is announced
    seenPricePaise: { type: Number, default: null },
    seenAvailable: { type: Boolean, default: null },
  },
  { collection: 'customer_wishlist_items', versionKey: false },
);

wishlistItemSchema.index({ customerId: 1, productId: 1 }, { unique: true });
wishlistItemSchema.index({ customerId: 1, addedAt: -1 });

export const WishlistItem = mongoose.models.WishlistItem ?? mongoose.model('WishlistItem', wishlistItemSchema);
