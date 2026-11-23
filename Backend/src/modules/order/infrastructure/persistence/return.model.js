import mongoose from 'mongoose';
import { RETURN_STATUS } from '../../domain/services/returnRules.js';

// A customer's request to send one delivered item back for a refund. The seller approves, the courier collects it, the seller
// checks it (QC) and the refund follows; only the request and its cancellation exist so far. `active` is true while the return
// counts against its item, which a unique index turns into "one return per item at a time".
const returnSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, immutable: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    subOrderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    orderNumber: { type: String, required: true, immutable: true }, // what the item looked like when asked for, so lists never need the order
    customerName: { type: String, default: null, immutable: true },
    sellerName: { type: String, default: null, immutable: true },
    productName: { type: String, required: true, immutable: true },
    variantLabel: { type: String, default: null, immutable: true },
    imageUrl: { type: String, default: null, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    resolution: { type: String, enum: ['REFUND'], default: 'REFUND', immutable: true },
    reasonCode: { type: String, required: true, immutable: true },
    faultAttribution: { type: String, enum: ['SELLER', 'CUSTOMER'], required: true },
    comment: { type: String, default: null },
    evidenceKeys: { type: [String], default: [] }, // private files the customer uploaded (their storage keys)
    pickupAddress: { type: mongoose.Schema.Types.Mixed, required: true }, // snapshot: a later address edit never moves the pickup
    status: { type: String, enum: Object.values(RETURN_STATUS), default: RETURN_STATUS.REQUESTED },
    active: { type: Boolean, default: true },
    amountPaise: { type: Number, required: true, immutable: true }, // what the item cost after its coupon share: the most that is refunded
    refund: {
      status: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'], default: 'NOT_REQUIRED' },
      destination: { type: String, default: 'ORIGINAL_PAYMENT' },
      failureReason: { type: String, default: null }, // why the last refund attempt was refused (Razorpay's words), until one works
      key: { type: String, default: null }, // names the refund on the payment once it is made: asking again never pays twice
    },
    // the courier's pickup from the customer (Shiprocket reverse shipment); filled in as each step succeeds, so a failed one resumes
    reverse: {
      shiprocketOrderId: { type: String, default: null },
      providerShipmentId: { type: String, default: null },
      awb: { type: String, default: null },
      courierName: { type: String, default: null },
      pickupRequestedAt: { type: Date, default: null },
      lockedUntil: { type: Date, default: null }, // one "schedule pickup" at a time
      pickupDueAt: { type: Date, default: null }, // when a booked pickup that nobody collected is chased
      cancelledAt: { type: Date, default: null }, // the courier booking was cancelled on Shiprocket
      opsAlertedAt: { type: Date, default: null }, // ops were emailed about a booking that could not be cancelled (once)
      cancelError: { type: String, default: null }, // why it could not be: the booking may still stand there, for ops to cancel
      chased: { type: Boolean, default: false }, // the courier was asked again once already
      events: { type: [{ _id: false, status: String, providerStatus: String, at: Date }], default: [] },
    },
    decision: { type: mongoose.Schema.Types.Mixed, default: null }, // the seller's rejection: { reasonCode, reason, at }
    qc: { type: mongoose.Schema.Types.Mixed, default: null }, // the seller's check of the returned item: { result, reasonCode, notes, at }
    qcDueAt: { type: Date, default: null }, // set when the item reaches the seller
    decisionDueAt: { type: Date, required: true },
    events: [{ _id: false, status: String, at: Date, actorType: String, actorId: String, note: String }],
  },
  { collection: 'returns', timestamps: true, versionKey: false },
);

returnSchema.index({ itemId: 1 }, { unique: true, partialFilterExpression: { active: true } });
returnSchema.index({ customerId: 1, _id: -1 });
returnSchema.index({ 'reverse.awb': 1 }, { unique: true, partialFilterExpression: { 'reverse.awb': { $type: 'string' } } });
returnSchema.index({ orderId: 1 });

export const Return = mongoose.models.Return ?? mongoose.model('Return', returnSchema);
