import mongoose from 'mongoose';

// A product's rating, kept as running totals of its PUBLISHED reviews (s1..s5 = how many gave that many stars), so
// product cards read one number instead of counting reviews. Changed only by atomic $inc (see review.service.js).
const star = { type: Number, default: 0 };
const summarySchema = new mongoose.Schema(
  { productId: { type: String, required: true, unique: true }, count: star, sum: star, s1: star, s2: star, s3: star, s4: star, s5: star },
  { collection: 'review_summaries', versionKey: false },
);

export const ReviewSummary = mongoose.models.ReviewSummary ?? mongoose.model('ReviewSummary', summarySchema);
