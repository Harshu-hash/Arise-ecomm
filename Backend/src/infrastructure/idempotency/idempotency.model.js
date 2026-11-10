import mongoose from 'mongoose';

const idempotencySchema = new mongoose.Schema(
  {
    scope: { type: String, required: true }, // actor-or-ip + method + path
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED'], default: 'IN_PROGRESS', required: true },
    lockedAt: { type: Date, default: Date.now },
    responseStatus: { type: Number, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { collection: 'idempotencyRecords', timestamps: true, versionKey: false },
);

idempotencySchema.index({ scope: 1, key: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const IdempotencyRecord =
  mongoose.models.IdempotencyRecord ?? mongoose.model('IdempotencyRecord', idempotencySchema);
