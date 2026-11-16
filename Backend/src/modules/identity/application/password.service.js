import { randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { hashPassword, sha256 } from '../../../shared/utils/crypto.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { revokeAllSessions } from './session.service.js';

const RESET_TTL_MS = 30 * 60 * 1000;

// Always succeeds, whether or not the email exists, so the response never reveals an account.
export async function forgotPassword({ allowedRoles, email, resetUrlBase }) {
  const normalised = String(email ?? '').trim().toLowerCase();
  const user = await User.findOne({ role: { $in: allowedRoles }, email: normalised, status: { $ne: 'INVITED' } });
  if (!user) return {};

  const token = `rst_${randomBytes(24).toString('hex')}`;
  await AuthChallenge.create({
    userId: String(user._id),
    audience: 'PASSWORD_RESET',
    stage: 'reset',
    verificationTokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  const resetUrl = `${resetUrlBase}?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Arise password',
    text: `Use this link to reset your password (expires in 30 minutes): ${resetUrl}`,
  });

  // Outside production only: lets dev/test run the flow without a real mail provider.
  return env.isProduction ? {} : { devHint: { resetUrl } };
}

export async function resetPassword({ token, password }) {
  const challenge = await AuthChallenge.findOne({
    audience: 'PASSWORD_RESET',
    stage: 'reset',
    verificationTokenHash: sha256(String(token ?? '')),
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) throw new UnauthorizedError('This reset link has expired. Request a new one.');

  const user = await User.findById(challenge.userId);
  if (!user) throw new UnauthorizedError('This reset link has expired. Request a new one.');

  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
  challenge.consumedAt = new Date();
  await Promise.all([user.save(), challenge.save(), revokeAllSessions(user._id)]);
  return {};
}
