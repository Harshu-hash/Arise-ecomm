import { stat } from 'node:fs/promises';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { publicUrl, resolveKey } from '../../../infrastructure/storage/local.storage.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { deliverOtp, makeOtp } from './customerAuth.service.js';

// A signed-in customer's own profile: name, gender, photo, and changing their email or phone. A new email/phone
// only replaces the current one after the customer proves they own it with a one-time code.
const AUDIENCE = 'CUSTOMER_CONTACT_CHANGE';
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
export const AVATAR_FOLDER = 'avatars';

const maskEmail = (email) => (email ? email.replace(/^(.).*(@.*)$/, '$1***$2') : null);
const maskPhone = (phone) => (phone ? `******${phone.slice(-4)}` : null);
const maskTarget = (field, value) => (field === 'EMAIL' ? maskEmail(value) : maskPhone(value));

const liveChallengeFilter = (userId) => ({ userId: String(userId), audience: AUDIENCE, consumedAt: null, expiresAt: { $gt: new Date() } });

function serialize(user, challenge) {
  return {
    id: String(user._id),
    name: user.name?.trim().length >= 2 ? user.name.trim() : 'Customer',
    emailMasked: maskEmail(user.email),
    phoneMasked: maskPhone(user.phone),
    // Customer accounts are created by OTP sign-in, so an email/phone on the account has been proven.
    emailVerified: Boolean(user.email),
    phoneVerified: Boolean(user.phone),
    gender: user.gender ?? 'PREFER_NOT_TO_SAY',
    avatarUrl: user.avatarKey ? deviceUrl(publicUrl(user.avatarKey)) : null,
    pendingVerification: challenge
      ? { challengeId: String(challenge._id), field: challenge.stage, destinationMasked: maskTarget(challenge.stage, challenge.target), expiresAt: challenge.expiresAt.toISOString() }
      : null,
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function customer(userId) {
  const user = await User.findOne({ _id: userId, role: ROLES.CUSTOMER });
  if (!user) throw new NotFoundError('Your account could not be found.');
  return user;
}

const pendingChallenge = (userId) => AuthChallenge.findOne(liveChallengeFilter(userId)).sort({ createdAt: -1 });

export async function getCustomerProfile(userId) {
  const user = await customer(userId);
  return serialize(user, await pendingChallenge(userId));
}

/** `+91 98765 43210` / `09876543210` / `9876543210` -> `9876543210`, the form sign-in stores. */
const normalisePhone = (value) => value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');

async function startContactChange(user, field, value) {
  const kind = field === 'EMAIL' ? 'email' : 'phone';
  const fieldName = field === 'EMAIL' ? 'newEmail' : 'newPhone';
  if (user[kind] === value) throw new ValidationError(`That is already your ${kind}.`, { [fieldName]: [`That is already your ${kind}.`] });
  if (await User.exists({ role: ROLES.CUSTOMER, [kind]: value, _id: { $ne: user._id } })) {
    throw new AppError({ code: 'CONTACT_IN_USE', status: 409, message: `Another account already uses this ${kind}.`, fieldErrors: { [fieldName]: [`Another account already uses this ${kind}.`] } });
  }
  // One pending change at a time: a new request replaces the old one.
  await AuthChallenge.updateMany(liveChallengeFilter(user._id), { $set: { consumedAt: new Date() } });
  const code = makeOtp();
  const challenge = await AuthChallenge.create({
    userId: String(user._id), audience: AUDIENCE, stage: field, target: value, codeHash: sha256(code), expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  await deliverOtp({ kind, value }, code);
  if (!env.isProduction) logger.info({ challengeId: String(challenge._id), code }, 'Dev only: contact-change verification code');
  return challenge;
}

/** Name/gender/photo apply at once; a new email or phone starts a verification instead. */
export async function updateCustomerProfile(userId, { name, gender, avatarMediaId, newEmail, newPhone }) {
  if (newEmail && newPhone) {
    throw new ValidationError('Change one contact at a time.', { newPhone: ['Verify your new email first, then change your phone.'] });
  }
  const user = await customer(userId);
  if (name !== undefined) user.name = name;
  if (gender !== undefined) user.gender = gender;
  if (avatarMediaId !== undefined) {
    // The id the upload returned is its storage key; it must be this customer's own avatar upload, still on disk.
    if (!avatarMediaId.startsWith(`public/${AVATAR_FOLDER}/${user._id}/`)) throw new ValidationError('Upload the photo first.', { avatar: ['Upload the photo first.'] });
    await stat(resolveKey(avatarMediaId)).catch(() => {
      throw new ValidationError('Upload the photo first.', { avatar: ['That photo is no longer available. Upload it again.'] });
    });
    user.avatarKey = avatarMediaId;
  }
  await user.save();

  let challenge = null;
  if (newEmail) challenge = await startContactChange(user, 'EMAIL', newEmail);
  if (newPhone) {
    const phone = normalisePhone(newPhone);
    if (!/^[6-9]\d{9}$/.test(phone)) throw new ValidationError('Enter a valid phone number.', { newPhone: ['Enter a valid 10-digit Indian mobile number.'] });
    challenge = await startContactChange(user, 'PHONE', phone);
  }
  return serialize(user, challenge ?? (await pendingChallenge(userId)));
}

/** The code from the new email/phone proves ownership; only then does it replace the old one. */
export async function verifyContactChange(userId, { challengeId, otp }) {
  const challenge = await AuthChallenge.findOne({ ...liveChallengeFilter(userId), _id: challengeId });
  if (!challenge) throw new AppError({ code: 'OTP_EXPIRED', status: 410, message: 'This verification has expired. Request a new code.' });
  if (sha256(String(otp).trim()) !== challenge.codeHash) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_CODE_ATTEMPTS) challenge.consumedAt = new Date();
    await challenge.save();
    throw new AppError({ code: 'OTP_INVALID', status: 422, message: 'The verification code is incorrect.', fieldErrors: { otp: ['The verification code is incorrect.'] } });
  }
  const user = await customer(userId);
  user[challenge.stage === 'EMAIL' ? 'email' : 'phone'] = challenge.target;
  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000) throw new ConflictError('CONTACT_IN_USE', 'Another account started using this in the meantime.');
    throw error;
  }
  challenge.consumedAt = new Date();
  challenge.verifiedAt = new Date();
  await challenge.save();
  return serialize(user, null);
}
