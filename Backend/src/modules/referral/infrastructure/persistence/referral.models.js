import mongoose from 'mongoose';

export const REFERRAL_STATUS = Object.freeze({
  PENDING: 'PENDING', // the friend signed up with the code but has no qualifying delivered order yet
  QUALIFIED: 'QUALIFIED', // their first qualifying order was delivered; the reward amounts are frozen, waiting for an admin (autoApprove off)
  REWARDED: 'REWARDED', // wallet credit paid
  REJECTED: 'REJECTED',
});

// One invite code per customer, made on first use.
const codeSchema = new mongoose.Schema(
  { userId: { type: String, required: true, unique: true }, code: { type: String, required: true, unique: true } },
  { collection: 'referralCodes', timestamps: true, versionKey: false },
);

// One row per invited friend. A customer can be invited once (refereeId is unique), so there is no reward farming by re-signing up.
const referralSchema = new mongoose.Schema(
  {
    referrerId: { type: String, required: true, immutable: true },
    refereeId: { type: String, required: true, unique: true, immutable: true },
    code: { type: String, required: true, immutable: true },
    status: { type: String, enum: Object.values(REFERRAL_STATUS), default: REFERRAL_STATUS.PENDING },
    orderId: { type: String, default: null }, // the delivered order that qualified it
    orderValuePaise: { type: Number, default: null },
    referrerRewardPaise: { type: Number, default: 0 }, // frozen when it qualifies, so a later settings change does not alter it
    refereeRewardPaise: { type: Number, default: 0 },
    qualifiedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
    decidedBy: { type: String, default: null }, // admin who approved / rejected; null when automatic
    flags: { type: [String], default: [] }, // fraud signals seen when it qualified (SAME_DEVICE, SAME_ADDRESS); a flagged referral is never paid automatically
    rejectReason: { type: String, default: null },
  },
  { collection: 'referrals', timestamps: true, versionKey: false },
);

referralSchema.index({ referrerId: 1, status: 1 });
referralSchema.index({ status: 1, createdAt: -1 });

export const ReferralCode = mongoose.models.ReferralCode ?? mongoose.model('ReferralCode', codeSchema);
export const Referral = mongoose.models.Referral ?? mongoose.model('Referral', referralSchema);
