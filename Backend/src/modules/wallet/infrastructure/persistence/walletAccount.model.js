import mongoose from 'mongoose';

// Per-customer wallet state. A frozen wallet cannot be spent (checkout ignores it); credits such as refunds still arrive.
const walletAccountSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, immutable: true },
    frozen: { type: Boolean, default: false },
    reason: { type: String, default: null },
    changedBy: { type: String, default: null },
    changedAt: { type: Date, default: null },
  },
  { collection: 'walletAccounts', versionKey: false },
);

export const WalletAccount = mongoose.models.WalletAccount ?? mongoose.model('WalletAccount', walletAccountSchema);
