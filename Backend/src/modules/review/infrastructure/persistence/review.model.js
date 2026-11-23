import mongoose from 'mongoose';
import { REVIEW_STATUS } from '../../domain/services/reviewRules.js';

const replySchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, required: true, maxlength: 1000 },
    status: { type: String, enum: ['PENDING', 'PUBLISHED', 'REJECTED'], default: 'PENDING' }, // public only once an admin publishes it
    authorName: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },
  },
  { _id: false },
);

// One customer's review of one order item (a delivered purchase). Product, seller and buyer details are copied from the order
// when it is written, so lists never need another module. Only PUBLISHED reviews count toward the product's rating.
const reviewSchema = new mongoose.Schema(
  {
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true }, // one review per purchase
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    subOrderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    authorName: { type: String, required: true, immutable: true },
    productId: { type: String, required: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    productName: { type: String, required: true, immutable: true },
    productImageUrl: { type: String, default: null, immutable: true },
    variantLabel: { type: String, default: null, immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 100, default: '' },
    body: { type: String, trim: true, required: true, minlength: 10, maxlength: 2000 },
    media: { type: [String], default: [] }, // storage keys of the customer's public review photos
    mediaHidden: { type: Boolean, default: false }, // an admin removed the photos
    status: { type: String, enum: Object.values(REVIEW_STATUS), required: true },
    moderationReason: { type: String, default: null }, // why an admin rejected it; the customer sees this
    autoModeration: { type: String, default: 'CLEAN' },
    incentivised: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
    sellerReply: { type: replySchema, default: null }, // one public answer from the seller; a rejected one may be replaced
  },
  { collection: 'reviews', timestamps: true, versionKey: false },
);

reviewSchema.index({ productId: 1, status: 1, _id: -1 });
reviewSchema.index({ customerId: 1, _id: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
