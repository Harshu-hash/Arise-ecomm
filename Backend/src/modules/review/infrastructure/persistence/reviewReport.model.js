import mongoose from 'mongoose';

// A complaint that a review breaks the rules, from the seller it is about or any customer. An admin dismisses it or removes the review.
// One row per reporter, so the admin sees how many different people flagged the same review.
const reportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['REVIEW'], default: 'REVIEW', immutable: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    targetExcerpt: { type: String, required: true, immutable: true }, // what the review said when reported
    reporterType: { type: String, enum: ['SELLER', 'CUSTOMER'], required: true, immutable: true },
    reporterId: { type: String, required: true, immutable: true }, // the seller's or the customer's id
    reason: { type: String, trim: true, required: true, maxlength: 1000 },
    status: { type: String, enum: ['OPEN', 'DISMISSED', 'REMOVED'], default: 'OPEN' },
    decisionReason: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  { collection: 'review_reports', timestamps: true, versionKey: false },
);

// One open report per reporter per review.
reportSchema.index({ targetId: 1, reporterId: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } });
reportSchema.index({ status: 1, createdAt: -1 });

export const ReviewReport = mongoose.models.ReviewReport ?? mongoose.model('ReviewReport', reportSchema);
