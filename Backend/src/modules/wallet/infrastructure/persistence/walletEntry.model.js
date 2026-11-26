import mongoose from 'mongoose';

export const ENTRY_TYPES = ['REFUND', 'CASHBACK', 'GIFT_CARD', 'REFERRAL', 'ORDER_PAYMENT', 'ADJUSTMENT'];

// Immutable ledger line of a customer's store credit. A CREDIT is also a "lot": `remainingPaise` is what is still spendable and
// `expiresAt` when it lapses, so a debit consumes the earliest-expiring lots first. The balance is always derived from the lots.
const entrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, immutable: true },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true, immutable: true },
    type: { type: String, enum: ENTRY_TYPES, required: true, immutable: true },
    title: { type: String, required: true },
    reference: { type: String, default: null },
    amountPaise: { type: Number, min: 1, required: true, immutable: true },
    remainingPaise: { type: Number, default: 0 }, // credits only
    expiresAt: { type: Date, default: null }, // credits only; null never expires
    balanceAfterPaise: { type: Number, required: true },
    key: { type: String, default: undefined }, // idempotency: the same business event never posts twice
  },
  { collection: 'walletEntries', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

entrySchema.index({ userId: 1, createdAt: -1 });
entrySchema.index({ userId: 1, direction: 1, remainingPaise: 1, expiresAt: 1 });
entrySchema.index({ key: 1 }, { unique: true, sparse: true });

export const WalletEntry = mongoose.models.WalletEntry ?? mongoose.model('WalletEntry', entrySchema);
