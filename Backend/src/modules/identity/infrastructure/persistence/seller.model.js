import mongoose from 'mongoose';

// Seed of the seller aggregate: the registration application plus what the login gate needs.
// The full seller domain (payouts, tiering, plan, growth metrics...) belongs to the seller/catalog
// module when it lands; it must extend THIS schema/collection, not redefine it.
const sellerSchema = new mongoose.Schema(
  {
    storeName: { type: String, required: true, trim: true },
    legalName: { type: String, default: null },
    ownerName: { type: String, default: null },
    status: {
      type: String,
      enum: ['UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED'],
      default: 'UNDER_REVIEW',
    },
    rejectionReason: { type: String, default: null },
    location: {
      locality: { type: String, default: null },
      pincode: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      address: { type: String, default: null },
    },
    // Private upload keys (see uploadPurposes.SELLER_KYC) — never served publicly, only via
    // /uploads/private/kyc/:sellerId/:file for the owner or an admin.
    documents: {
      tradeLicenseKey: { type: String, default: null },
      gstCertificateKey: { type: String, default: null },
      idProofKey: { type: String, default: null },
    },
    // Admin QC on the onboarding queue. Verification itself (GSTIN lookup, PAN match, bank
    // penny-drop) is a future integration; the *Ok flags start false and are set by that review.
    // gstin/pan/bank.accountNumber are stored via encryptField (crypto.js: "bank account, PAN,
    // GST... at rest"); decrypt only where an admin is actually viewing the application.
    gstin: { type: String, default: null },
    gstinOk: { type: Boolean, default: false },
    pan: { type: String, default: null },
    panOk: { type: Boolean, default: false },
    bank: {
      accountHolder: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
    bankOk: { type: Boolean, default: false },
    // Per-document admin decision (approve/reject + why), one entry per DOCUMENT_TYPE.
    documentDecisions: {
      tradeLicense: {
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        reason: { type: String, default: null },
      },
      gstCertificate: {
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        reason: { type: String, default: null },
      },
      idProof: {
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        reason: { type: String, default: null },
      },
    },
    infoRequested: { type: [String], default: [] }, // checklist sent to the applicant, cleared on resubmission
    appliedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    // Performance/commercial fields (tier, GMV, payouts, lifecycle holds...) belong to the
    // seller/catalog/finance modules when they land; a freshly-approved seller legitimately
    // has none of that yet, so the admin "full seller" page gets honest zeros, not fake data.
    tier: { type: String, enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'], default: 'BRONZE' },
  },
  { collection: 'sellers', timestamps: true, versionKey: false },
);

// The onboarding queue's two access patterns: filter by status (sorted by recency), and
// lookup/sort by store name.
sellerSchema.index({ status: 1, appliedAt: -1 });
sellerSchema.index({ storeName: 1 });

export const Seller = mongoose.models.Seller ?? mongoose.model('Seller', sellerSchema);
