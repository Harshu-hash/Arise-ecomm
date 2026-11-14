import { http as mswHttp } from 'msw';
import { db, find, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  simulateNetwork,
  unauthorized,
  validationFailed,
} from '@mocks/engine/respond';
import {
  createSession,
  findSessionByRefresh,
  resolveCaller,
  revokeSession,
  rotateAccessToken,
  sessionPayload,
} from '@seller/mocks/engine/sellerAuth';
import { permissionsForRole } from '@seller/rbac/permissions';

export const SELLER_BASE = '/api/seller/v1';
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function makeRegistrationCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalisePhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function registrationChallenge(kind, target) {
  return insert('authChallenges', {
    id: id('ROTP', 6),
    userId: null,
    audience: 'SELLER_REGISTRATION',
    stage: `verify_${kind}`,
    target,
    code: makeRegistrationCode(),
    expiresAt: new Date(mockNow() + CHALLENGE_TTL_MS).toISOString(),
    attempts: 0,
    consumedAt: null,
    verifiedAt: null,
    verificationToken: null,
  });
}

function verifiedRegistrationToken(token, kind, target) {
  return find(
    'authChallenges',
    (challenge) =>
      challenge.audience === 'SELLER_REGISTRATION' &&
      challenge.stage === `verify_${kind}` &&
      challenge.target === target &&
      challenge.verificationToken === token &&
      challenge.verifiedAt &&
      !challenge.consumedAt &&
      new Date(challenge.expiresAt).getTime() > mockNow(),
  );
}

function makeBackupCodes() {
  return Array.from({ length: 8 }, () => ({
    code: `${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
    usedAt: null,
  }));
}

function ensureTwoFactorMaterial(user) {
  if (user.twoFactorSecret && user.backupCodes?.length) return user;
  return update('sellerUsers', user.id, {
    twoFactorSecret: user.twoFactorSecret ?? `ARISESELLER${user.id.replace(/[^A-Z0-9]/gi, '')}`,
    backupCodes: user.backupCodes?.length ? user.backupCodes : makeBackupCodes(),
  });
}

function createChallenge(user, stage) {
  return insert('authChallenges', {
    id: id('SCHL', 6),
    userId: user.id,
    audience: 'SELLER',
    stage,
    code: makeCode(),
    expiresAt: new Date(mockNow() + CHALLENGE_TTL_MS).toISOString(),
    attempts: 0,
    consumedAt: null,
  });
}

function liveChallenge(challengeId) {
  const challenge = findById('authChallenges', challengeId);
  if (!challenge || challenge.audience !== 'SELLER' || challenge.consumedAt) return null;
  return new Date(challenge.expiresAt).getTime() > mockNow() ? challenge : null;
}

function challengePayload(rawUser, forcedStage) {
  const user = ensureTwoFactorMaterial(rawUser);
  const stage = forcedStage ?? (user.twoFactorEnrolled ? 'verify_2fa' : 'enrol_2fa');
  const challenge = createChallenge(user, stage);
  scheduleSave();
  return {
    stage,
    challengeId: challenge.id,
    maskedEmail: user.email.replace(/^(.{2}).*(@.*)$/, '$1•••••$2'),
    ...(stage === 'enrol_2fa'
      ? {
          secret: user.twoFactorSecret,
          otpauthUrl: `otpauth://totp/Arise%20Seller:${encodeURIComponent(user.email)}?secret=${user.twoFactorSecret}&issuer=Arise%20Seller`,
        }
      : {}),
    devHint: { code: challenge.code },
  };
}

function passwordPolicyErrors(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password ?? '')) errors.push('a letter');
  if (!/[0-9]/.test(password ?? '')) errors.push('a number');
  return errors;
}

function issue(user, extra = {}) {
  const session = createSession(user);
  update('sellerUsers', user.id, { lastLoginAt: mockNowIso() });
  scheduleSave();
  return ok({ ...sessionPayload(findById('sellerUsers', user.id), session), ...extra });
}

export const sellerAuthHandlers = [
  /* ----------------------------------------------------------------- login */
  mswHttp.post(`${SELLER_BASE}/auth/login`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/login');
    if (injected) return injected;

    const body = await request.json();
    const identifier = String(body?.emailOrPhone ?? body?.email ?? '').trim();
    const email = identifier.toLowerCase();
    const phone = normalisePhone(identifier);

    if (db.sellerUsers.length === 0) {
      return conflict(
        'The demo data is missing or was saved by an older build. Reset it to sign in.',
        'MOCK_DATA_EMPTY',
      );
    }

    const user = find(
      'sellerUsers',
      (u) => u.email.toLowerCase() === email || (phone.length === 10 && normalisePhone(u.phone) === phone),
    );
    const generic = () => unauthorized('Email/phone or password is incorrect.');
    if (!user) return generic();

    if (user.status === 'SUSPENDED') {
      return forbidden('This seller account has been suspended. Contact Arise support.', {
        details: { code: 'SUSPENDED' },
      });
    }
    if (user.status === 'INVITED' || user.status === 'DEACTIVATED') return generic();
    if (user.password !== body?.password) return generic();

    const seller = findById('sellers', user.sellerId);
    const application = find('sellerOnboarding', (row) => row.sellerId === user.sellerId);
    const applicationStatus = application?.status ?? seller?.status ?? 'UNDER_REVIEW';
    if (!['APPROVED', 'ACTIVE'].includes(applicationStatus) || !['APPROVED', 'ACTIVE'].includes(seller?.status)) {
      return forbidden('Login is enabled only after your seller application is approved.', {
        details: {
          applicationStatus,
          rejectionReason: application?.rejectionReason ?? seller?.rejectionReason ?? null,
          email: user.email,
          storeName: seller?.storeName ?? user.storeName,
        },
      });
    }

    return ok(challengePayload(user));
  }),

  /* ----------------------------------------- registration uniqueness check */
  mswHttp.post(`${SELLER_BASE}/auth/register/check-exists`, async ({ request }) => {
    const body = await request.json();
    const kind = body?.kind === 'phone' ? 'phone' : 'email';
    const value = kind === 'phone'
      ? normalisePhone(body?.value)
      : String(body?.value ?? '').trim().toLowerCase();
    const exists = kind === 'phone'
      ? find('sellerUsers', (user) => normalisePhone(user.phone) === value)
      : find('sellerUsers', (user) => user.email.toLowerCase() === value);
    return ok({ exists: Boolean(exists) });
  }),

  /* ------------------------------------------------ registration OTP send */
  mswHttp.post(`${SELLER_BASE}/auth/register/send-otp`, async ({ request }) => {
    const body = await request.json();
    const kind = body?.kind === 'phone' ? 'phone' : 'email';
    const target = kind === 'phone'
      ? normalisePhone(body?.value)
      : String(body?.value ?? '').trim().toLowerCase();
    if ((kind === 'phone' && target.length !== 10) || (kind === 'email' && !target.includes('@'))) {
      return validationFailed({ value: `Enter a valid ${kind}.` });
    }
    const duplicate = kind === 'phone'
      ? find('sellerUsers', (user) => normalisePhone(user.phone) === target)
      : find('sellerUsers', (user) => user.email.toLowerCase() === target);
    if (duplicate) return conflict(`This ${kind} is already registered.`, `${kind.toUpperCase()}_TAKEN`);
    const challenge = registrationChallenge(kind, target);
    scheduleSave();
    return ok({ challengeId: challenge.id, expiresInSeconds: CHALLENGE_TTL_MS / 1000, devHint: { code: challenge.code } });
  }),

  /* ---------------------------------------------- registration OTP verify */
  mswHttp.post(`${SELLER_BASE}/auth/register/verify-otp`, async ({ request }) => {
    const body = await request.json();
    const challenge = findById('authChallenges', body?.challengeId);
    if (!challenge || challenge.audience !== 'SELLER_REGISTRATION' || challenge.consumedAt || new Date(challenge.expiresAt).getTime() <= mockNow()) {
      return unauthorized('This verification code expired. Request a new code.');
    }
    if (String(body?.code ?? '').trim() !== challenge.code) {
      const attempts = challenge.attempts + 1;
      update('authChallenges', challenge.id, { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { consumedAt: mockNowIso() } : {}) });
      return validationFailed({ code: 'That code is not correct.' }, 'That code is not correct.');
    }
    const verificationToken = `svt_${id('TOKEN', 8)}_${Math.random().toString(36).slice(2, 10)}`;
    update('authChallenges', challenge.id, { verifiedAt: mockNowIso(), verificationToken });
    scheduleSave();
    return ok({ verificationToken, kind: challenge.stage.replace('verify_', ''), value: challenge.target });
  }),

  /* ------------------------------------------------------------ 2FA verify */
  mswHttp.post(`${SELLER_BASE}/auth/2fa/verify`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/2fa/verify');
    if (injected) return injected;
    const body = await request.json();
    const challenge = liveChallenge(body?.challengeId);
    if (!challenge) return unauthorized('This sign-in attempt expired. Please sign in again.');
    const user = findById('sellerUsers', challenge.userId);
    if (!user || !user.twoFactorEnrolled) return unauthorized('This sign-in attempt expired. Please sign in again.');

    const code = String(body?.code ?? '').trim();
    const backup = (user.backupCodes ?? []).find((item) => !item.usedAt && item.code === code.toUpperCase());
    if (code !== challenge.code && !backup) {
      const attempts = challenge.attempts + 1;
      update('authChallenges', challenge.id, { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { consumedAt: mockNowIso() } : {}) });
      scheduleSave();
      if (attempts >= MAX_CODE_ATTEMPTS) return unauthorized('Too many incorrect codes. Please sign in again.');
      return validationFailed({ code: 'That code is not correct.' }, 'That code is not correct.');
    }

    if (backup) backup.usedAt = mockNowIso();
    update('authChallenges', challenge.id, { consumedAt: mockNowIso() });
    return issue(user);
  }),

  /* ------------------------------------------------------------- 2FA enrol */
  mswHttp.post(`${SELLER_BASE}/auth/2fa/enrol`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/2fa/enrol');
    if (injected) return injected;
    const body = await request.json();
    const challenge = liveChallenge(body?.challengeId);
    if (!challenge || challenge.stage !== 'enrol_2fa') return unauthorized('This sign-in attempt expired. Please sign in again.');
    const user = findById('sellerUsers', challenge.userId);
    if (!user) return unauthorized('This sign-in attempt expired. Please sign in again.');
    if (String(body?.code ?? '').trim() !== challenge.code) {
      return validationFailed({ code: 'That code is not correct.' }, 'That code is not correct.');
    }
    const updated = update('sellerUsers', user.id, { twoFactorEnrolled: true });
    update('authChallenges', challenge.id, { consumedAt: mockNowIso() });
    return issue(updated, {
      backupCodes: (updated.backupCodes ?? []).filter((item) => !item.usedAt).map((item) => item.code),
    });
  }),

  /* -------------------------------------------------------------- register */
  mswHttp.post(`${SELLER_BASE}/auth/register`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/register');
    if (injected) return injected;

    const contentType = request.headers.get('content-type') ?? '';
    let body;
    if (contentType.includes('application/json')) body = await request.json();
    else {
      try {
        body = Object.fromEntries((await request.formData()).entries());
      } catch (error) {
        return badRequest(`Could not parse multipart application: ${error.message}`, 'MULTIPART_INVALID');
      }
    }
    const email = String(body?.email ?? '').trim().toLowerCase();
    const phone = normalisePhone(body?.phone);
    const storeName = String(body?.shopName ?? '').trim();
    const fieldErrors = {};
    const ownerName = String(body?.name ?? '').trim();
    if (!ownerName) fieldErrors.name = 'Enter the owner name.';
    else if (ownerName.length > 50 || !/^[A-Za-z ]+$/.test(ownerName)) fieldErrors.name = 'Use at most 50 letters and spaces.';
    if (!storeName) fieldErrors.shopName = 'Enter your shop or business name.';
    if (!email || !email.includes('@')) fieldErrors.email = 'Enter a valid email.';
    if (phone.length !== 10) fieldErrors.phone = 'Enter a 10-digit contact number.';
    const pwErrors = passwordPolicyErrors(body?.password);
    if (pwErrors.length) fieldErrors.password = `Password needs ${pwErrors.join(', ')}.`;
    if (!String(body?.locality ?? '').trim()) fieldErrors.locality = 'Enter the locality or area.';
    if (!/^\d{6}$/.test(String(body?.pincode ?? ''))) fieldErrors.pincode = 'Enter a 6-digit pincode.';
    if (!String(body?.city ?? '').trim()) fieldErrors.city = 'Enter the city.';
    if (!String(body?.state ?? '').trim()) fieldErrors.state = 'Enter the state.';
    if (!String(body?.address ?? '').trim()) fieldErrors.address = 'Enter the full address.';
    if (!verifiedRegistrationToken(body?.emailVerificationToken, 'email', email)) fieldErrors.email = 'Verify this email again.';
    if (!verifiedRegistrationToken(body?.phoneVerificationToken, 'phone', phone)) fieldErrors.phone = 'Verify this phone again.';
    for (const [field, label] of [['tradeLicense', 'Trade license'], ['gstCertificate', 'GST certificate'], ['idProof', 'ID proof']]) {
      if (!body[field] || !body[field].name || body[field].size === 0) fieldErrors[field] = `${label} is required.`;
      else if (!['application/pdf', 'image/jpeg', 'image/png'].includes(body[field].type)) fieldErrors[field] = `${label} must be a PDF, JPG or PNG.`;
      else if (body[field].size > 20 * 1024 * 1024) fieldErrors[field] = `${label} must be 20 MB or smaller.`;
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    if (find('sellerUsers', (u) => u.email.toLowerCase() === email)) {
      return conflict('An account with this email already exists.', 'EMAIL_TAKEN', {
        fieldErrors: { email: 'This email is already registered.' },
      });
    }

    if (find('sellerUsers', (u) => normalisePhone(u.phone) === phone)) {
      return conflict('An account with this phone already exists.', 'PHONE_TAKEN', {
        fieldErrors: { phone: 'This phone is already registered.' },
      });
    }

    // The reference flow creates a submitted application, not an authenticated
    // half-configured account. Admin approval is the gate that unlocks login.
    const sellerId = id('SEL', 4);
    insert('sellers', {
      id: sellerId,
      storeName,
      legalName: storeName,
      status: 'UNDER_REVIEW',
      tier: 'BRONZE',
      gstin: null,
      pan: null,
      city: String(body?.city ?? '').trim(),
      state: String(body?.state ?? '').trim(),
      pincode: String(body?.pincode ?? '').trim(),
      phone,
      address: String(body?.address ?? '').trim(),
      locality: String(body?.locality ?? '').trim(),
      rating: null,
      liveListings: 0,
      gmv30dPaise: 0,
      orders30d: 0,
      cancellationPct: 0,
      lateDispatchPct: 0,
      returnPct: 0,
      payoutOnHold: false,
      accountManagerId: null,
      fulfillmentTypes: ['SELLER'],
      appliedAt: mockNowIso(),
      joinedAt: null,
      version: 1,
    });
    const application = insert('sellerOnboarding', {
      id: id('ONB', 4),
      sellerId,
      flowVersion: 'QUICK_COMMERCE_V1',
      status: 'UNDER_REVIEW',
      step: 3,
      business: { storeName, legalName: storeName, ownerName },
      location: { address: body.address, locality: body.locality, pincode: body.pincode, city: body.city, state: body.state },
      submittedAt: mockNowIso(),
      createdAt: mockNowIso(),
      updatedAt: mockNowIso(),
      version: 1,
    });
    const user = insert('sellerUsers', {
      id: id('SUSR', 4),
      sellerId,
      name: ownerName,
      email,
      phone,
      password: body.password,
      avatarColor: '#2874F0',
      status: 'ACTIVE',
      roleKey: 'owner',
      roleName: 'Account Owner',
      storeName,
      permissions: permissionsForRole('owner'),
      mustChangePassword: false,
      twoFactorEnrolled: false,
      twoFactorSecret: `ARISESELLER${sellerId.replace(/[^A-Z0-9]/gi, '')}`,
      backupCodes: makeBackupCodes(),
      lastLoginAt: null,
      createdAt: mockNowIso(),
      version: 1,
    });

    const docs = [
      ['tradeLicense', 'TRADE_LICENSE', 'Trade license'],
      ['gstCertificate', 'GST_CERTIFICATE', 'GST certificate'],
      ['idProof', 'ID_PROOF', 'Identity proof'],
    ];
    for (const [field, type, label] of docs) {
      const file = body[field];
      insert('kycDocuments', {
        id: id('DOC', 6), sellerId, applicationId: application.id, sectionKey: 'documents', type, label,
        fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size,
        uploadedAt: mockNowIso(), status: 'PENDING', rejectionReason: null, version: 1,
      });
    }
    for (const token of [body.emailVerificationToken, body.phoneVerificationToken]) {
      const challenge = find('authChallenges', (item) => item.verificationToken === token);
      if (challenge) update('authChallenges', challenge.id, { consumedAt: mockNowIso() });
    }
    scheduleSave();
    return created({
      applicationId: application.id,
      applicationStatus: 'UNDER_REVIEW',
      email: user.email,
      storeName,
      submittedAt: application.submittedAt,
      message: 'Application submitted. Login is enabled only after admin approval.',
    });
  }),

  /* --------------------------------------------------------------- refresh */
  mswHttp.post(`${SELLER_BASE}/auth/refresh`, async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const session = findSessionByRefresh(body?.refreshToken);
    if (!session) return unauthorized('Your session expired. Please sign in again.');
    const user = findById('sellerUsers', session.userId);
    if (!user) return unauthorized();
    const rotated = rotateAccessToken(session);
    scheduleSave();
    return ok(sessionPayload(user, rotated));
  }),

  /* ---------------------------------------------------------------- logout */
  mswHttp.post(`${SELLER_BASE}/auth/logout`, async ({ request }) => {
    const { session } = resolveCaller(request);
    if (session) {
      revokeSession(session.id);
      scheduleSave();
    }
    return ok({ ok: true });
  }),

  /* ------------------------------------------------------- forgot password */
  mswHttp.post(`${SELLER_BASE}/auth/forgot-password`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/forgot-password');
    if (injected) return injected;
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const user = find('sellerUsers', (u) => u.email.toLowerCase() === email);
    // Always 200, so the form cannot enumerate registered emails. The reset
    // token is surfaced as a dev hint only when the email actually exists.
    const resetToken = user ? `sreset_${user.id}_${Math.random().toString(36).slice(2, 10)}` : null;
    if (user) {
      update('sellerUsers', user.id, { resetToken, resetTokenExpiresAt: new Date(mockNow() + 3600_000).toISOString() });
      scheduleSave();
    }
    return ok({ sent: true, devHint: resetToken });
  }),

  /* -------------------------------------------------------- reset password */
  mswHttp.post(`${SELLER_BASE}/auth/reset-password`, async ({ request }) => {
    const body = await request.json();
    const pwErrors = passwordPolicyErrors(body?.password);
    if (pwErrors.length) return validationFailed({ password: `Password needs ${pwErrors.join(', ')}.` });
    const user = find('sellerUsers', (u) => u.resetToken && u.resetToken === body?.token);
    if (!user || new Date(user.resetTokenExpiresAt ?? 0).getTime() < mockNow()) {
      return badRequest('This reset link is invalid or has expired.', 'RESET_INVALID');
    }
    update('sellerUsers', user.id, { password: body.password, resetToken: null, resetTokenExpiresAt: null });
    scheduleSave();
    return ok({ reset: true });
  }),

  /* --------------------------------------------------------- invite lookup */
  mswHttp.get(`${SELLER_BASE}/auth/invite/:token`, async ({ params }) => {
    const user = find('sellerUsers', (u) => u.inviteToken && u.inviteToken === params.token);
    if (!user || user.status !== 'INVITED') return notFound('This invitation is invalid or already accepted.');
    return ok({ email: user.email, name: user.name, roleName: user.roleName, storeName: user.storeName });
  }),

  /* -------------------------------------------------------- invite accept */
  mswHttp.post(`${SELLER_BASE}/auth/invite/accept`, async ({ request }) => {
    const body = await request.json();
    const user = find('sellerUsers', (u) => u.inviteToken && u.inviteToken === body?.token);
    if (!user || user.status !== 'INVITED') return badRequest('This invitation is invalid or already accepted.', 'INVITE_INVALID');
    const pwErrors = passwordPolicyErrors(body?.password);
    if (pwErrors.length) return validationFailed({ password: `Password needs ${pwErrors.join(', ')}.` });
    update('sellerUsers', user.id, {
      password: body.password,
      name: body?.name || user.name,
      status: 'ACTIVE',
      inviteToken: null,
    });
    const fresh = ensureTwoFactorMaterial(findById('sellerUsers', user.id));
    scheduleSave();
    return ok(challengePayload(fresh, 'enrol_2fa'));
  }),
];
