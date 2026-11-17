import { randomBytes, randomInt } from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { AppError, ConflictError, ForbiddenError, RateLimitError, UnauthorizedError } from '../../../shared/errors/AppError.js';
import { hashPassword, sha256 } from '../../../shared/utils/crypto.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { createSession, revokeAllSessions } from './session.service.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_DELAY_MS = 30 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const AUDIENCE = 'CUSTOMER_AUTH';
const STAGES = Object.freeze({ LOGIN: 'login', SIGNUP: 'signup', PASSWORD_RESET: 'password_reset' });

const normaliseIdentifier = (identifier) => {
  const value = String(identifier ?? '').trim();
  if (value.includes('@')) return { kind: 'email', value: value.toLowerCase() };
  return { kind: 'phone', value: value.replace(/\D/g, '').slice(-10) };
};

const userFilter = ({ kind, value }) => ({ role: ROLES.CUSTOMER, [kind]: value });
const makeOtp = () => String(randomInt(1000, 10_000));
const purposeOf = (stage) => Object.entries(STAGES).find(([, value]) => value === stage)?.[0];
const mask = ({ kind, value }) =>
  kind === 'email' ? value.replace(/(^.).*(@.*$)/, '$1***$2') : `******${value.slice(-4)}`;

async function deliverOtp(target, code) {
  const message = `Your Arise verification code is ${code}. It expires in 5 minutes.`;
  if (target.kind === 'email') {
    await sendMail({ to: target.value, subject: 'Your Arise verification code', text: message });
    return;
  }
  if (!env.SMS_OTP_URL) {
    logger.warn('SMS provider not configured; customer OTP was not delivered');
    return;
  }
  const response = await fetch(env.SMS_OTP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.SMS_OTP_TOKEN ? { authorization: `Bearer ${env.SMS_OTP_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to: target.value, message }),
  });
  if (!response.ok) throw new Error(`SMS gateway rejected OTP delivery with status ${response.status}`);
}

function challengeBody(challenge, code) {
  const target = normaliseIdentifier(challenge.target);
  return {
    challengeId: String(challenge._id),
    destinationMasked: mask(target),
    expiresAt: challenge.expiresAt,
    resendAvailableAt: new Date(challenge.createdAt.getTime() + RESEND_DELAY_MS),
    purpose: purposeOf(challenge.stage),
    isNewCustomer: challenge.stage === STAGES.SIGNUP,
    ...(env.isProduction ? {} : { devHint: { code } }),
  };
}

async function createChallenge({ target, purpose, name = null, userId = null }) {
  const code = makeOtp();
  const challenge = await AuthChallenge.create({
    userId: userId ? String(userId) : null,
    audience: AUDIENCE,
    stage: STAGES[purpose],
    target: target.value,
    name,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await deliverOtp(target, code);
  return challengeBody(challenge, code);
}

export async function startCustomerAuth({ identifier, purpose, name }) {
  const target = normaliseIdentifier(identifier);
  const user = await User.findOne(userFilter(target));
  if (purpose === 'SIGNUP' && user) throw new ConflictError('CUSTOMER_EXISTS', 'An account already exists for this email or phone.');
  return createChallenge({ target, purpose, name, userId: user?._id });
}

export async function resendCustomerOtp({ challengeId }) {
  const previous = await AuthChallenge.findById(challengeId);
  if (!previous || previous.audience !== AUDIENCE || previous.consumedAt || previous.expiresAt <= new Date()) {
    throw new AppError({ code: 'OTP_EXPIRED', status: 410, message: 'This verification request has expired.' });
  }
  if (previous.createdAt.getTime() + RESEND_DELAY_MS > Date.now()) throw new RateLimitError('Wait before requesting another code.');
  previous.consumedAt = new Date();
  await previous.save();
  return createChallenge({
    target: normaliseIdentifier(previous.target),
    purpose: purposeOf(previous.stage),
    name: previous.name,
    userId: previous.userId,
  });
}

async function liveChallenge(challengeId, stage) {
  const challenge = await AuthChallenge.findById(challengeId);
  if (!challenge || challenge.audience !== AUDIENCE || (stage && challenge.stage !== stage) || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    throw new AppError({ code: 'OTP_EXPIRED', status: 410, message: 'This verification request has expired.' });
  }
  return challenge;
}

async function verifyCode(challenge, otp) {
  if (sha256(String(otp ?? '').trim()) === challenge.codeHash) return;
  challenge.attempts += 1;
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) challenge.consumedAt = new Date();
  await challenge.save();
  throw new AppError({ code: 'OTP_INVALID', status: 422, message: 'The verification code is incorrect.', fieldErrors: { otp: ['The verification code is incorrect.'] } });
}

function assertCustomerIsActive(user) {
  if (!user || user.role !== ROLES.CUSTOMER || ['INVITED', 'DEACTIVATED'].includes(user.status)) {
    throw new UnauthorizedError('This sign-in attempt is no longer valid.');
  }
  if (user.status === 'SUSPENDED') throw new ForbiddenError('This account has been suspended. Contact Arise support.');
}

export async function verifyCustomerOtp({ challengeId, otp, device, requiredStage }) {
  const challenge = await liveChallenge(challengeId, requiredStage);
  if (challenge.stage === STAGES.PASSWORD_RESET) throw new UnauthorizedError('Use the password-reset verification endpoint.');
  await verifyCode(challenge, otp);

  let user = challenge.userId ? await User.findById(challenge.userId) : null;
  if (challenge.stage === STAGES.SIGNUP) {
    const target = normaliseIdentifier(challenge.target);
    if (await User.exists(userFilter(target))) throw new ConflictError('CUSTOMER_EXISTS', 'An account already exists for this email or phone.');
    try {
      user = await User.create({ role: ROLES.CUSTOMER, [target.kind]: target.value, name: challenge.name, status: 'ACTIVE' });
    } catch (error) {
      if (error?.code === 11000) throw new ConflictError('CUSTOMER_EXISTS', 'An account already exists for this email or phone.');
      throw error;
    }
  }
  assertCustomerIsActive(user);
  challenge.consumedAt = new Date();
  await challenge.save();
  const tokens = await createSession({ userId: user._id, role: user.role, device });
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return { user, tokens };
}

export async function verifyCustomerPasswordReset({ challengeId, otp }) {
  const challenge = await liveChallenge(challengeId, STAGES.PASSWORD_RESET);
  await verifyCode(challenge, otp);
  if (!challenge.userId) throw new UnauthorizedError('This reset request is no longer valid.');
  const resetToken = `crt_${randomBytes(24).toString('hex')}`;
  challenge.codeHash = null;
  challenge.verifiedAt = new Date();
  challenge.verificationTokenHash = sha256(resetToken);
  challenge.expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await challenge.save();
  return { resetToken, expiresAt: challenge.expiresAt };
}

export async function resetCustomerPassword({ resetToken, password }) {
  const challenge = await AuthChallenge.findOne({
    audience: AUDIENCE,
    stage: STAGES.PASSWORD_RESET,
    verifiedAt: { $ne: null },
    consumedAt: null,
    verificationTokenHash: sha256(resetToken),
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) throw new AppError({ code: 'RESET_TOKEN_EXPIRED', status: 410, message: 'Start password reset again.' });
  const user = await User.findById(challenge.userId);
  assertCustomerIsActive(user);
  user.passwordHash = await hashPassword(password);
  challenge.consumedAt = new Date();
  await Promise.all([user.save(), challenge.save(), revokeAllSessions(user._id)]);
  return { success: true };
}
