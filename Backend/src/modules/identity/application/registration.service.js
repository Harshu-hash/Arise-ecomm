import { randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { saveUpload } from '../../../infrastructure/storage/local.storage.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { UPLOAD_PURPOSES } from '../../../shared/constants/uploadPurposes.js';
import { AppError, ConflictError, UnauthorizedError, ValidationError } from '../../../shared/errors/AppError.js';
import { encryptField, hashPassword, sha256 } from '../../../shared/utils/crypto.js';
import { AuthChallenge } from '../infrastructure/persistence/authChallenge.model.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SELLER_ROLES = [ROLES.SELLER, ROLES.SELLER_STAFF];
const DOC_FIELDS = ['tradeLicense', 'gstCertificate', 'idProof'];

const normaliseEmail = (value) => String(value ?? '').trim().toLowerCase();
const normalisePhone = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);
const normalise = (kind, value) => (kind === 'phone' ? normalisePhone(value) : normaliseEmail(value));
// 4 digits: the registration OTP field in RegisterPage.jsx is hard-coded to 4 (maxLength,
// slice(0, 4)) — a longer code here would never fit what the user can type.
const makeOtp = () => String(Math.floor(1000 + Math.random() * 9000));

async function findExisting(kind, value) {
  const filter = kind === 'phone' ? { phone: value } : { email: value };
  return User.findOne({ role: { $in: SELLER_ROLES }, ...filter }).lean();
}

// Best-effort delivery: email goes through the SMTP transport (no-op with a warning if unconfigured,
// same as the rest of the mailer). Phone has no SMS provider wired up yet.
async function deliverOtp(kind, target, code) {
  if (kind === 'email') {
    await sendMail({
      to: target,
      subject: 'Your Arise verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
    return;
  }
  logger.warn({ target }, 'SMS provider not configured; phone OTP was not delivered');
}

export async function checkExists({ kind, value }) {
  return { exists: Boolean(await findExisting(kind, normalise(kind, value))) };
}

export async function sendRegistrationOtp({ kind, value }) {
  const target = normalise(kind, value);
  if ((kind === 'phone' && target.length !== 10) || (kind === 'email' && !target.includes('@'))) {
    throw new ValidationError('Request validation failed.', { value: [`Enter a valid ${kind}.`] });
  }
  if (await findExisting(kind, target)) {
    throw new ConflictError(`${kind.toUpperCase()}_TAKEN`, `This ${kind} is already registered.`);
  }

  const code = makeOtp();
  const challenge = await AuthChallenge.create({
    audience: 'SELLER_REGISTRATION',
    stage: `verify_${kind}`,
    target,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await deliverOtp(kind, target, code);
  // Outside production only: lets dev/test run the flow without a real email/SMS provider wired up.
  return {
    challengeId: String(challenge._id),
    expiresInSeconds: OTP_TTL_MS / 1000,
    ...(env.isProduction ? {} : { devHint: { code } }),
  };
}

export async function verifyRegistrationOtp({ challengeId, code }) {
  const challenge = await AuthChallenge.findById(challengeId);
  if (!challenge || challenge.audience !== 'SELLER_REGISTRATION' || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    throw new UnauthorizedError('This verification code expired. Request a new code.');
  }
  if (sha256(String(code ?? '').trim()) !== challenge.codeHash) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_CODE_ATTEMPTS) challenge.consumedAt = new Date();
    await challenge.save();
    throw new AppError({ code: 'VALIDATION_ERROR', status: 422, message: 'That code is not correct.', fieldErrors: { code: ['That code is not correct.'] } });
  }

  const verificationToken = `svt_${randomBytes(24).toString('hex')}`;
  challenge.verifiedAt = new Date();
  challenge.verificationTokenHash = sha256(verificationToken);
  await challenge.save();
  return { verificationToken, kind: challenge.stage.replace('verify_', ''), value: challenge.target };
}

async function assertVerified(kind, target, token) {
  const challenge = await AuthChallenge.findOne({
    audience: 'SELLER_REGISTRATION',
    stage: `verify_${kind}`,
    target,
    verifiedAt: { $ne: null },
    consumedAt: null,
    verificationTokenHash: sha256(String(token ?? '')),
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) throw new UnauthorizedError(`Verify your ${kind} again.`);
  return challenge;
}

// Creates the application, not an authenticated account: login stays blocked (see auth.service's
// assertSellerIsLive) until an admin approves the Seller record this writes.
export async function registerSeller({ fields, files }) {
  const email = normaliseEmail(fields.email);
  const phone = normalisePhone(fields.phone);

  const [emailChallenge, phoneChallenge] = await Promise.all([
    assertVerified('email', email, fields.emailVerificationToken),
    assertVerified('phone', phone, fields.phoneVerificationToken),
  ]);
  if (await findExisting('email', email)) throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists.');
  if (await findExisting('phone', phone)) throw new ConflictError('PHONE_TAKEN', 'An account with this phone already exists.');

  const seller = await Seller.create({
    storeName: fields.shopName,
    legalName: fields.shopName,
    ownerName: fields.name,
    location: { locality: fields.locality, pincode: fields.pincode, city: fields.city, state: fields.state, address: fields.address },
    gstin: encryptField(fields.gstin),
    pan: encryptField(fields.pan),
    bank: {
      accountHolder: fields.bankAccountHolder,
      accountNumber: encryptField(fields.bankAccountNumber),
      ifsc: fields.bankIfsc,
    },
  });

  try {
    const kyc = UPLOAD_PURPOSES.SELLER_KYC;
    const [tradeLicense, gstCertificate, idProof] = await Promise.all(
      DOC_FIELDS.map((name) =>
        saveUpload({ file: files[name][0], allowedKinds: kyc.kinds, visibility: kyc.visibility, scope: `${kyc.folder}/${seller._id}` }),
      ),
    );
    seller.documents = { tradeLicenseKey: tradeLicense.key, gstCertificateKey: gstCertificate.key, idProofKey: idProof.key };
    await seller.save();

    const user = await User.create({
      role: ROLES.SELLER,
      email,
      phone,
      name: fields.name,
      passwordHash: await hashPassword(fields.password),
      sellerId: String(seller._id),
      status: 'UNDER_REVIEW',
    });

    await Promise.all([
      AuthChallenge.updateOne({ _id: emailChallenge._id }, { $set: { consumedAt: new Date() } }),
      AuthChallenge.updateOne({ _id: phoneChallenge._id }, { $set: { consumedAt: new Date() } }),
    ]);

    return { sellerId: String(seller._id), userId: String(user._id), status: 'UNDER_REVIEW' };
  } catch (error) {
    await Seller.deleteOne({ _id: seller._id }); // no orphaned application on a failed write
    throw error;
  }
}
