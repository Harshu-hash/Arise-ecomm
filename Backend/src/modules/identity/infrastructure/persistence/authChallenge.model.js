import mongoose from 'mongoose';

// Short-lived, single-use codes: login 2FA today; registration OTP and password reset
// reuse the same shape later. Only hashes are stored, never the raw code/token.
const authChallengeSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null, immutable: true },
    audience: { type: String, required: true, immutable: true }, // e.g. LOGIN_2FA, SELLER_REGISTRATION, PASSWORD_RESET
    stage: { type: String, required: true },
    target: { type: String, default: null }, // email/phone being verified, when userId is not yet known
    // Absent for TOTP-backed challenges (LOGIN_2FA): the proof there is the user's own
    // authenticator/backup code, not a server-issued shared secret.
    codeHash: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'authChallenges', timestamps: true, versionKey: false },
);

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ userId: 1, audience: 1 });

export const AuthChallenge =
  mongoose.models.AuthChallenge ?? mongoose.model('AuthChallenge', authChallengeSchema);
