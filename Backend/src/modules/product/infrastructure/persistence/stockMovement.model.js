import mongoose from 'mongoose';

// Append-only stock ledger for an offer: every change to its stock, with the balance it left.
const stockMovementSchema = new mongoose.Schema(
  {
    offerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    type: { type: String, enum: ['ADJUSTMENT', 'LISTING_EDIT', 'SALE', 'CANCELLATION', 'RTO', 'RETURN'], required: true, immutable: true },
    qty: { type: Number, required: true, immutable: true },
    balanceAfter: { type: Number, required: true, immutable: true },
    note: { type: String, default: null, immutable: true },
    reference: { type: String, default: null, immutable: true },
    actorId: { type: String, default: null, immutable: true },
    at: { type: Date, required: true, immutable: true },
  },
  { collection: 'stock_movements', versionKey: false },
);

stockMovementSchema.index({ offerId: 1, at: -1, _id: -1 });

export const StockMovement = mongoose.models.StockMovement ?? mongoose.model('StockMovement', stockMovementSchema);
