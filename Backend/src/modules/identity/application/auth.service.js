import { randomBytes } from 'node:crypto';
import { AppError, ForbiddenError, UnauthorizedError } from '../../../shared/errors/AppError.js';
import { decryptField, encryptField, hashPassword, sha256, verifyPassword } from '../../../shared/utils/crypto.js';
import { generateTotpSecret, totpUri, verifyTotp } from '../../../shared/utils/totp.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { createSession } from './session.service.js';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SELLER_ROLES = [ROLES.SELLER, ROLES.SELLER_STAFF];
// 2FA is off for every audience: removed from admin sign-in in 50ad7b4, removed from
// seller sign-in here, and customers never had it. The enrol/verify machinery (and its
// routes) is left in place, unreachable from login, in case 2FA becomes optional later.
const TWO_FACTOR_ROLES = [];
const TOTP_ISSUER = 'Arise Seller';

const invalidCredentials = () => new UnauthorizedError('Email/phone or password is incorrect.');

export function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    sellerId: user.sellerId,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnrolled: user.twoFactor?.enrolled ?? false,
    // Reaching login at all already means the Seller aggregate is APPROVED/ACTIVE (see
    // assertSellerIsLive) — there is no separate in-app onboarding wizard to gate on.
    ...(SELLER_ROLES.includes(user.role) ? { onboardingComplete: true } : {}),
    ...(user.role === ROLES.ADMIN ? { permissions: user.permissions ?? [], scope: user.scope ?? null } : {}),
  };
}

function maskEmail(email) {
  return String(email).replace(/^(.{2}).*(@.*)$/, '$1•••••$2');
}

async function findByIdentifier(identifier, allowedRoles) {
  const value = String(identifier ?? '').trim();
  const email = value.toLowerCase();
  const phone = value.replace(/\D/g, '').slice(-10);
  const or = [{ email }];
  if (phone.length === 10) or.push({ phone });
  return User.findOne({ role: { $in: allowedRoles }, $or: or });
}

async function assertSellerIsLive(sellerId) {
  const seller = sellerId ? await Seller.findById(sellerId).lean() : null;
  if (!seller || !['APPROVED', 'ACTIVE'].includes(seller.status)) {
    throw new AppError({
      code: 'SELLER_NOT_APPROVED',
      status: 403,
      message: 'Login is enabled only after your seller application is approved.',
      details: { applicationStatus: seller?.status ?? 'UNDER_REVIEW', rejectionReason: seller?.rejectionReason ?? null },
    });
  }
}

const generateBackupCodes = (count = 8) => Array.from({ length: count }, () => randomBytes(5).toString('hex').toUpperCase());

async function newChallenge(user, stage) {
  return AuthChallenge.create({
    userId: String(user._id),
    audience: 'LOGIN_2FA',
    stage,
    codeHash: null, // the proof is a TOTP/backup code checked against the user's own secret, not a shared code
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

async function issueChallenge(user) {
  if (!user.twoFactor?.enrolled) {
    if (!user.twoFactor?.secret) {
      user.twoFactor = { enrolled: false, secret: encryptField(generateTotpSecret()), backupCodes: [] };
      await user.save();
    }
    const secret = decryptField(user.twoFactor.secret);
    const challenge = await newChallenge(user, 'enrol_2fa');
    return {
      stage: 'enrol_2fa',
      challengeId: String(challenge._id),
      secret,
      otpauthUrl: totpUri({ secret, account: user.email, issuer: TOTP_ISSUER }),
    };
  }
  const challenge = await newChallenge(user, 'verify_2fa');
  return { stage: 'verify_2fa', challengeId: String(challenge._id), maskedEmail: maskEmail(user.email) };
}

async function finishLogin(user, device) {
  const tokens = await createSession({ userId: user._id, role: user.role, sellerId: user.sellerId, device });
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return { stage: 'authenticated', tokens, user: publicUser(user) };
}

// Shared with the invite-accept flow: a freshly-activated account goes through the same
// "enrol/verify 2FA, or go straight in" branch a normal login does.
export function requiresTwoFactor(role) {
  return TWO_FACTOR_ROLES.includes(role);
}

export { finishLogin, issueChallenge };

// `allowedRoles` scopes login to the audience the route is mounted under
// (e.g. the admin login endpoint must never authenticate a SELLER account).
export async function login({ allowedRoles, identifier, password, device }) {
  const user = await findByIdentifier(identifier, allowedRoles);
  if (!user) throw invalidCredentials();
  if (['INVITED', 'DEACTIVATED'].includes(user.status)) throw invalidCredentials();
  if (user.status === 'SUSPENDED') {
    throw new ForbiddenError('This account has been suspended. Contact Arise support.');
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw invalidCredentials();

  if (SELLER_ROLES.includes(user.role)) await assertSellerIsLive(user.sellerId);

  if (TWO_FACTOR_ROLES.includes(user.role)) return issueChallenge(user);
  return finishLogin(user, device);
}

const wrongCode = () =>
  new AppError({ code: 'VALIDATION_ERROR', status: 422, message: 'That code is not correct.', fieldErrors: { code: ['That code is not correct.'] } });

async function liveChallenge(challengeId, stage) {
  const challenge = await AuthChallenge.findById(challengeId);
  if (!challenge || challenge.audience !== 'LOGIN_2FA' || challenge.stage !== stage || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    throw new UnauthorizedError('This sign-in attempt expired. Please sign in again.');
  }
  return challenge;
}

async function registerAttempt(challenge) {
  challenge.attempts += 1;
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) challenge.consumedAt = new Date();
  await challenge.save();
  if (challenge.consumedAt) throw new UnauthorizedError('Too many incorrect codes. Please sign in again.');
  throw wrongCode();
}

export async function verifyTwoFactor({ challengeId, code, device }) {
  const challenge = await liveChallenge(challengeId, 'verify_2fa');
  const user = await User.findById(challenge.userId);
  if (!user || !user.twoFactor?.enrolled) throw new UnauthorizedError('This sign-in attempt expired. Please sign in again.');

  const given = String(code ?? '').trim();
  const backupCode = user.twoFactor.backupCodes.find((entry) => !entry.usedAt && entry.codeHash === sha256(given.toUpperCase()));
  const totpStep = backupCode ? null : verifyTotp(decryptField(user.twoFactor.secret), given);
  if (!backupCode && totpStep === null) return registerAttempt(challenge);

  if (backupCode) backupCode.usedAt = new Date();
  challenge.consumedAt = new Date();
  await Promise.all([challenge.save(), user.save()]);
  return finishLogin(user, device);
}

// Completes first-time enrolment: the authenticator code itself is the proof (no shared secret to leak),
// so success both confirms the app is set up correctly and reveals the one-time backup codes.
export async function enrolTwoFactor({ challengeId, code, device }) {
  const challenge = await liveChallenge(challengeId, 'enrol_2fa');
  const user = await User.findById(challenge.userId);
  if (!user || !user.twoFactor?.secret) throw new UnauthorizedError('This sign-in attempt expired. Please sign in again.');

  const given = String(code ?? '').trim();
  if (verifyTotp(decryptField(user.twoFactor.secret), given) === null) return registerAttempt(challenge);

  const backupCodes = generateBackupCodes();
  user.twoFactor.enrolled = true;
  user.twoFactor.backupCodes = backupCodes.map((plain) => ({ codeHash: sha256(plain) }));
  challenge.consumedAt = new Date();
  await Promise.all([challenge.save(), user.save()]);

  const result = await finishLogin(user, device);
  return { ...result, backupCodes };
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new UnauthorizedError('Current password is incorrect.');
  }
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
}
