import { randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { hashPassword, sha256 } from '../../../shared/utils/crypto.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { finishLogin, issueChallenge, requiresTwoFactor } from './auth.service.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Called by role-specific management endpoints (e.g. the admin "invite an admin" modal,
// seller staff invites) — not exposed as its own public route.
export async function issueInvite({ role, email, name, sellerId = null, permissions = null, scope = null }) {
  const normalisedEmail = String(email).trim().toLowerCase();
  if (await User.findOne({ role, email: normalisedEmail })) {
    throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const token = `inv_${randomBytes(24).toString('hex')}`;
  const user = await User.create({
    role,
    email: normalisedEmail,
    name,
    sellerId,
    permissions: permissions ?? undefined,
    scope: scope ?? undefined,
    status: 'INVITED',
    inviteTokenHash: sha256(token),
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  await sendMail({
    to: normalisedEmail,
    subject: 'You have been invited to Arise',
    text: `You have been invited to join Arise. Use this link to set up your account: ${token}`,
  });

  return {
    userId: String(user._id),
    email: user.email,
    // Outside production only: lets dev/test accept the invite without a real mail provider.
    ...(env.isProduction ? {} : { devHint: { token } }),
  };
}

async function findLiveInvite(token) {
  const user = await User.findOne({
    status: 'INVITED',
    inviteTokenHash: sha256(String(token ?? '')),
    inviteExpiresAt: { $gt: new Date() },
  });
  if (!user) throw new NotFoundError('This invitation is no longer valid.');
  return user;
}

export async function getInvite(token) {
  const user = await findLiveInvite(token);
  return { email: user.email, name: user.name, role: user.role };
}

export async function acceptInvite({ token, name, password, device }) {
  const user = await findLiveInvite(token);
  user.name = name || user.name;
  user.passwordHash = await hashPassword(password);
  user.status = 'ACTIVE';
  user.inviteTokenHash = null;
  user.inviteExpiresAt = null;
  await user.save();

  if (requiresTwoFactor(user.role)) return issueChallenge(user);
  return finishLogin(user, device);
}
