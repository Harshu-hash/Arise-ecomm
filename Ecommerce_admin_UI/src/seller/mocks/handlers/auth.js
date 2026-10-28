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

function passwordPolicyErrors(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password ?? '')) errors.push('a letter');
  if (!/[0-9]/.test(password ?? '')) errors.push('a number');
  return errors;
}

function issue(user) {
  const session = createSession(user);
  update('sellerUsers', user.id, { lastLoginAt: mockNowIso() });
  scheduleSave();
  return ok(sessionPayload(findById('sellerUsers', user.id), session));
}

export const sellerAuthHandlers = [
  /* ----------------------------------------------------------------- login */
  mswHttp.post(`${SELLER_BASE}/auth/login`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/login');
    if (injected) return injected;

    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (db.sellerUsers.length === 0) {
      return conflict(
        'The demo data is missing or was saved by an older build. Reset it to sign in.',
        'MOCK_DATA_EMPTY',
      );
    }

    const user = find('sellerUsers', (u) => u.email.toLowerCase() === email);
    const generic = () => unauthorized('Email or password is incorrect.');
    if (!user) return generic();

    if (user.status === 'SUSPENDED') {
      return forbidden('This seller account has been suspended. Contact Arise support.', {
        details: { code: 'SUSPENDED' },
      });
    }
    if (user.password !== body?.password) return generic();

    return issue(user);
  }),

  /* -------------------------------------------------------------- register */
  mswHttp.post(`${SELLER_BASE}/auth/register`, async ({ request }) => {
    const injected = await simulateNetwork('/auth/register');
    if (injected) return injected;

    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const storeName = String(body?.storeName ?? '').trim();
    const fieldErrors = {};
    if (!storeName) fieldErrors.storeName = 'Enter your store name.';
    if (!email || !email.includes('@')) fieldErrors.email = 'Enter a valid email.';
    const pwErrors = passwordPolicyErrors(body?.password);
    if (pwErrors.length) fieldErrors.password = `Password needs ${pwErrors.join(', ')}.`;
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    if (find('sellerUsers', (u) => u.email.toLowerCase() === email)) {
      return conflict('An account with this email already exists.', 'EMAIL_TAKEN', {
        fieldErrors: { email: 'This email is already registered.' },
      });
    }

    // A fresh seller + a DRAFT onboarding application, both in the shared DB so
    // the admin "Onboarding Applications" screen can review it once submitted.
    const sellerId = id('SEL', 4);
    insert('sellers', {
      id: sellerId,
      storeName,
      legalName: body?.legalName || `${storeName} Pvt Ltd`,
      status: 'ONBOARDING',
      tier: 'BRONZE',
      gstin: null,
      pan: null,
      city: body?.city ?? null,
      state: body?.state ?? null,
      pincode: body?.pincode ?? null,
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
    insert('sellerOnboarding', {
      id: id('ONB', 4),
      sellerId,
      status: 'DRAFT',
      step: 0,
      business: { storeName, legalName: body?.legalName || `${storeName} Pvt Ltd`, category: null },
      tax: { gstin: null, pan: null },
      bank: null,
      pickup: null,
      agreementAcceptedAt: null,
      submittedAt: null,
      createdAt: mockNowIso(),
      updatedAt: mockNowIso(),
      version: 1,
    });
    const user = insert('sellerUsers', {
      id: id('SUSR', 4),
      sellerId,
      name: body?.name || storeName,
      email,
      phone: body?.phone ?? null,
      password: body.password,
      avatarColor: '#2874F0',
      status: 'ACTIVE',
      roleKey: 'owner',
      roleName: 'Account Owner',
      storeName,
      permissions: permissionsForRole('owner'),
      mustChangePassword: false,
      lastLoginAt: mockNowIso(),
      createdAt: mockNowIso(),
      version: 1,
    });

    const session = createSession(user);
    scheduleSave();
    return created(sessionPayload(user, session));
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
    const fresh = findById('sellerUsers', user.id);
    const session = createSession(fresh);
    scheduleSave();
    return ok(sessionPayload(fresh, session));
  }),
];
