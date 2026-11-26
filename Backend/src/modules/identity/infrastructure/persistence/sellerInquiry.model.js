import mongoose from 'mongoose';

const sellerInquirySchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    businessName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    gstin: { type: String, required: true },
    mobile: { type: String, required: true },
    pickupPincode: { type: String, required: true },
    consentVersion: { type: String, required: true, immutable: true },
    status: { type: String, enum: ['RECEIVED'], default: 'RECEIVED' },
    submittedAt: { type: Date, default: Date.now, immutable: true },
    inviteSentAt: { type: Date, default: null },
    inviteSentBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { collection: 'seller_inquiries', timestamps: true, versionKey: false },
);

sellerInquirySchema.index({ submittedAt: -1 });
sellerInquirySchema.index({ email: 1 });

export const SellerInquiry =
  mongoose.models.SellerInquiry ?? mongoose.model('SellerInquiry', sellerInquirySchema);
