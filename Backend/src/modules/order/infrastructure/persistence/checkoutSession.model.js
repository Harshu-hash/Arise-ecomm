import mongoose from 'mongoose';

export const SESSION_STATUS = Object.freeze({ OPEN: 'OPEN', PLACED: 'PLACED', EXPIRED: 'EXPIRED' });

// One checkout: what is being bought (offer ids and quantities only), where it goes, and the last quote the customer
// was shown. The quote is a snapshot: the customer is charged and the order is written from it, so what they saw is what
// they get. `payment-intent` re-prices first and refuses (CHECKOUT_CHANGED) if the total moved.
const sessionSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    source: { type: String, enum: ['CART', 'BUY_NOW'], required: true, immutable: true },
    cartVersion: { type: Number, default: null },
    items: { type: [{ _id: false, offerId: mongoose.Schema.Types.ObjectId, quantity: Number }], required: true },
    couponCode: { type: String, default: null },
    address: { type: mongoose.Schema.Types.Mixed, required: true },
    selectedPaymentMethod: { type: String, enum: ['upi', 'card', 'cod', null], default: null },
    quote: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.OPEN },
    expiresAt: { type: Date, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { collection: 'checkout_sessions', timestamps: true, versionKey: false },
);

sessionSchema.index({ customerId: 1, createdAt: -1 });

export const CheckoutSession = mongoose.models.CheckoutSession ?? mongoose.model('CheckoutSession', sessionSchema);
