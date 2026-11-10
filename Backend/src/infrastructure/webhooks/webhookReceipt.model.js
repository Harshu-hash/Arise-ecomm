import mongoose from 'mongoose';

// Shared by every provider (Razorpay, shipping partners): one dedup receipt per provider event.
export const RECEIPT_STATUS = Object.freeze({
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  UNHANDLED: 'UNHANDLED', // stored but no handler registered yet; replayable later
  FAILED: 'FAILED',
});

const webhookReceiptSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, immutable: true },
    providerEventId: { type: String, required: true, immutable: true },
    eventType: { type: String, required: true, immutable: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    status: { type: String, enum: Object.values(RECEIPT_STATUS), default: RECEIPT_STATUS.RECEIVED, required: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { collection: 'webhookReceipts', timestamps: true, versionKey: false },
);

// Dedup key: a provider retry of the same event hits this unique index and is acknowledged, not reprocessed.
webhookReceiptSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
webhookReceiptSchema.index({ status: 1, createdAt: 1 }); // reconciliation sweep
webhookReceiptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const WebhookReceipt =
  mongoose.models.WebhookReceipt ?? mongoose.model('WebhookReceipt', webhookReceiptSchema);
