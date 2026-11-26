import mongoose from 'mongoose';

export const GIFT_CARD_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', REDEEMED: 'REDEEMED', BLOCKED: 'BLOCKED' });

// A prepaid code an admin generated in a batch. Redeeming it once adds `amountPaise` of store credit to the customer's wallet.
// Only a hash of the PIN is kept; the admin sees code and PIN once, when the batch is made.
const giftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, immutable: true },
    pinHash: { type: String, required: true, immutable: true },
    amountPaise: { type: Number, min: 1, required: true, immutable: true },
    status: { type: String, enum: Object.values(GIFT_CARD_STATUS), default: GIFT_CARD_STATUS.ACTIVE },
    expiresAt: { type: Date, required: true },
    batchNote: { type: String, default: '' },
    createdBy: { type: String, default: null, immutable: true },
    redeemedBy: { type: String, default: null },
    redeemedAt: { type: Date, default: null },
  },
  { collection: 'giftCards', timestamps: true, versionKey: false },
);

giftCardSchema.index({ status: 1, createdAt: -1 });

export const GiftCard = mongoose.models.GiftCard ?? mongoose.model('GiftCard', giftCardSchema);
