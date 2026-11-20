import mongoose from 'mongoose';

export const DELETION_REASONS = ['ANOTHER_ACCOUNT', 'PRIVACY', 'NOT_USING', 'EXPERIENCE', 'OTHER'];

const accountDeletionSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    reasonCode: { type: String, enum: DELETION_REASONS, required: true, immutable: true },
    status: { type: String, enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED'], default: 'SCHEDULED' },
    requestedAt: { type: Date, required: true },
    scheduledDeletionAt: { type: Date, required: true },
    processingAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { collection: 'customer_account_deletions', timestamps: true, versionKey: false },
);

accountDeletionSchema.index({ status: 1, scheduledDeletionAt: 1, processingAt: 1 });

export const AccountDeletion =
  mongoose.models.CustomerAccountDeletion ??
  mongoose.model('CustomerAccountDeletion', accountDeletionSchema);
