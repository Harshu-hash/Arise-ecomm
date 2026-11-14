import mongoose from 'mongoose';
import { ROLES } from '../../../../shared/constants/roles.js';

const backupCodeSchema = new mongoose.Schema(
  { codeHash: { type: String, required: true }, usedAt: { type: Date, default: null } },
  { _id: false },
);

// One collection for every role: session/JWT issuance already treats role generically,
// and most account concerns (password, 2FA, status) are identical across audiences.
const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: Object.values(ROLES), required: true, immutable: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    // No default: must stay genuinely absent (not null) when unset, or the sparse unique
    // index below would collide on every account without a phone (e.g. admin invites).
    phone: { type: String },
    // Null while status is INVITED: no password exists until the invite is accepted.
    passwordHash: { type: String, default: null },
    name: { type: String, default: null },
    // Set for SELLER / SELLER_STAFF only; multiple users (owner + staff) can share one sellerId.
    sellerId: { type: String, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'INVITED', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    mustChangePassword: { type: Boolean, default: false },
    twoFactor: {
      enrolled: { type: Boolean, default: false },
      secret: { type: String, default: null }, // stored via encryptField
      backupCodes: { type: [backupCodeSchema], default: [] },
    },
    // Admin-only fine-grained RBAC (roleTemplates/scopes ported from the admin console design).
    permissions: { type: [String], default: undefined },
    scope: { type: mongoose.Schema.Types.Mixed, default: undefined },
    lastLoginAt: { type: Date, default: null },
    // Invite flow: set while status is INVITED, cleared once accepted.
    inviteTokenHash: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
  },
  { collection: 'users', timestamps: true, versionKey: false },
);

userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ sellerId: 1 });

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
