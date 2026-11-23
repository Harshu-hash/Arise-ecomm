import mongoose from 'mongoose';

const STATUS = ['PENDING', 'PUBLISHED', 'REJECTED'];

// A customer's question about a product, and the answers to it. Product and author details are copied when written,
// so lists never need another module. Only PUBLISHED ones are public; clean text publishes itself, the rest wait for an admin.
const questionSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    authorName: { type: String, required: true, immutable: true },
    productId: { type: String, required: true, immutable: true },
    productName: { type: String, required: true, immutable: true },
    body: { type: String, trim: true, required: true, minlength: 5, maxlength: 500 },
    status: { type: String, enum: STATUS, required: true },
    moderationReason: { type: String, default: null },
    autoModeration: { type: String, default: 'CLEAN' },
  },
  { collection: 'questions', timestamps: true, versionKey: false },
);
questionSchema.index({ productId: 1, status: 1, _id: -1 });
questionSchema.index({ customerId: 1, _id: -1 });
questionSchema.index({ status: 1, createdAt: -1 });

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    authorType: { type: String, enum: ['CUSTOMER', 'SELLER', 'SUPPORT'], required: true, immutable: true },
    authorId: { type: String, required: true, immutable: true }, // customer, seller or admin user id
    authorName: { type: String, required: true, immutable: true },
    body: { type: String, trim: true, required: true, minlength: 2, maxlength: 2000 },
    status: { type: String, enum: STATUS, required: true }, // sellers' answers always wait for an admin
    moderationReason: { type: String, default: null },
    helpfulCount: { type: Number, default: 0 },
  },
  { collection: 'answers', timestamps: true, versionKey: false },
);
answerSchema.index({ questionId: 1, status: 1, _id: 1 });
answerSchema.index({ authorType: 1, status: 1 });

export const Question = mongoose.models.Question ?? mongoose.model('Question', questionSchema);
export const Answer = mongoose.models.Answer ?? mongoose.model('Answer', answerSchema);
