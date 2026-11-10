import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, immutable: true },
    role: { type: String, required: true, immutable: true },
    sellerId: { type: String, default: null, immutable: true },
    // Only SHA-256 digests of refresh-token ids are stored, never the token itself.
    refreshHash: { type: String, required: true },
    previousHash: { type: String, default: null }, // detects replay of an already-rotated token
    device: {
      userAgent: { type: String, default: null },
      ip: { type: String, default: null },
      label: { type: String, default: null },
    },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { collection: 'authSessions', timestamps: true, versionKey: false },
);

sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = mongoose.models.AuthSession ?? mongoose.model('AuthSession', sessionSchema);
