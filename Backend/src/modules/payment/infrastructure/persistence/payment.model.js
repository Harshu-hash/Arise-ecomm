import mongoose from 'mongoose';

export const PAYMENT_STATUS = Object.freeze({
  REQUIRES_ACTION: 'REQUIRES_ACTION', // the Razorpay order exists; the customer has not paid yet
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED', // an attempt failed; the same Razorpay order can still be paid, and a later capture wins
  CANCELLED: 'CANCELLED',
  COD_PENDING: 'COD_PENDING', // cash on delivery: nothing is charged now, the courier collects it; the checkout is committed
});

export const REFUND_STATUS = Object.freeze({ PENDING: 'PENDING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' });

// One payment attempt for one checkout. `amountPaise` is what the customer was asked to pay; a capture for any other
// amount is never honoured.
const paymentSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    checkoutSessionId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    method: { type: String, enum: ['upi', 'card', 'cod'], required: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.REQUIRES_ACTION },
    amountPaise: { type: Number, min: 1, required: true, immutable: true },
    provider: { type: String, default: 'RAZORPAY', immutable: true }, // COD for cash on delivery
    providerOrderId: { type: String, required: true, immutable: true },
    providerPaymentId: { type: String, default: null },
    failureReason: { type: String, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Money given back, possibly in parts (one per cancelled seller parcel). `key` makes each refund safe to retry.
    refunds: {
      type: [{
        _id: false,
        key: { type: String, required: true },
        status: { type: String, enum: Object.values(REFUND_STATUS), required: true },
        providerRefundId: { type: String, default: null },
        amountPaise: { type: Number, required: true },
        reason: { type: String, default: null },
        initiatedAt: { type: Date, default: null }, // when the refund was first asked for (older entries have none)
        failureReason: { type: String, default: null }, // why Razorpay refused it, when it did
      }],
      default: [],
    },
  },
  { collection: 'payments', timestamps: true, versionKey: false },
);

paymentSchema.index({ providerOrderId: 1 }, { unique: true });
paymentSchema.index({ checkoutSessionId: 1, createdAt: -1 });

export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
