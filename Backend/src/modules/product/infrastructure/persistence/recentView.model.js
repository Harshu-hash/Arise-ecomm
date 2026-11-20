import mongoose from 'mongoose';

// One row per customer per product they opened; viewedAt moves forward each time. Feeds "Still looking for these?".
const recentViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { collection: 'recent_product_views', versionKey: false },
);
recentViewSchema.index({ userId: 1, productId: 1 }, { unique: true });
recentViewSchema.index({ userId: 1, viewedAt: -1 });
recentViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 }); // forget after 60 days

export const RecentView = mongoose.models.RecentView ?? mongoose.model('RecentView', recentViewSchema);
