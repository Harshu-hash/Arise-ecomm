import mongoose from 'mongoose';

const ariseRatingSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    ratedAt: { type: Date, required: true },
  },
  { collection: 'arise_ratings', timestamps: true, versionKey: false },
);

ariseRatingSchema.index({ ratedAt: -1 });
ariseRatingSchema.index({ rating: 1, ratedAt: -1 });

export const AriseRating =
  mongoose.models.AriseRating ?? mongoose.model('AriseRating', ariseRatingSchema);
