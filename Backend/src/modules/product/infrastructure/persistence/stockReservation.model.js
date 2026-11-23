import mongoose from 'mongoose';

export const RESERVATION_STATUS = Object.freeze({ HELD: 'HELD', COMMITTED: 'COMMITTED', RELEASED: 'RELEASED', EXPIRED: 'EXPIRED', RETURNED: 'RETURNED' });

// Units of one offer held for one checkout/order (`reference`) while it is paid for. HELD units count against the offer's
// `reserved`; COMMITTED ones have left its `stock`; RELEASED and EXPIRED ones went back to the shelf, and RETURNED ones were sold and then given back (order cancelled).
const reservationSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, immutable: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    customerId: { type: String, default: null, immutable: true },
    qty: { type: Number, min: 1, required: true, immutable: true },
    status: { type: String, enum: Object.values(RESERVATION_STATUS), default: RESERVATION_STATUS.HELD },
    expiresAt: { type: Date, required: true },
    settledAt: { type: Date, default: null },
  },
  { collection: 'stock_reservations', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// A retried hold finds its own earlier one instead of taking the units twice.
reservationSchema.index({ reference: 1, offerId: 1 }, { unique: true });
// The expiry sweep.
reservationSchema.index({ status: 1, expiresAt: 1 });

export const StockReservation = mongoose.models.StockReservation ?? mongoose.model('StockReservation', reservationSchema);
