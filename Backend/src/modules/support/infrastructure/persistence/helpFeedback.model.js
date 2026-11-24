import mongoose from 'mongoose';

// A customer's "was this helpful?" answer on a help article: one per customer per article, changeable.
const schema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    articleId: { type: String, required: true, immutable: true },
    helpful: { type: Boolean, required: true },
  },
  { collection: 'help_feedback', timestamps: true, versionKey: false },
);
schema.index({ customerId: 1, articleId: 1 }, { unique: true });

export const HelpFeedback = mongoose.models.HelpFeedback ?? mongoose.model('HelpFeedback', schema);
