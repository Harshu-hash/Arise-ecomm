import mongoose from 'mongoose';

const outboxEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, immutable: true },
    eventType: { type: String, required: true, immutable: true },
    eventVersion: { type: Number, required: true, default: 1, immutable: true },
    aggregateType: { type: String, required: true, immutable: true },
    aggregateId: { type: String, required: true, immutable: true },
    sellerId: { type: String, default: null, immutable: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      required: true,
    },
    attempts: { type: Number, default: 0, required: true },
    availableAt: { type: Date, default: Date.now, required: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { collection: 'outboxEvents', timestamps: true, versionKey: false },
);

outboxEventSchema.index({ status: 1, availableAt: 1, lockedAt: 1, createdAt: 1 });
outboxEventSchema.index({ aggregateType: 1, aggregateId: 1, createdAt: 1 });

export const OutboxEvent =
  mongoose.models.OutboxEvent ?? mongoose.model('OutboxEvent', outboxEventSchema);

