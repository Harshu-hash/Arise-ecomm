import { db, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';

/**
 * Session issuing and resolution for the seller panel's mock backend — the
 * seller-side twin of the admin `engine/auth`. Tokens are opaque strings that
 * index into `sellerSessions`; nothing is signed. Kept separate from the admin
 * auth engine so the two apps' sessions never collide and the module boundary
 * (seller code imports only the shared foundation) holds.
 */

const ACCESS_TTL_MS = 15 * 60 * 1000;
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

function token(prefix, sessionId) {
  return `${prefix}_${sessionId}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createSession(user, { device, ip, city } = {}) {
  const sessionId = id('SSES', 6);
  const now = mockNow();
  const session = {
    id: sessionId,
    userId: user.id,
    accessToken: token('sellerat', sessionId),
    refreshToken: token('sellerrt', sessionId),
    accessExpiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
    absoluteExpiresAt: new Date(now + ABSOLUTE_TTL_MS).toISOString(),
    createdAt: mockNowIso(),
    lastActiveAt: mockNowIso(),
    revokedAt: null,
    device: device ?? 'Chrome on Windows',
    ip: ip ?? '103.21.58.14',
    city: city ?? 'Ahmedabad, GJ',
  };
  insert('sellerSessions', session);
  return session;
}

export function rotateAccessToken(session) {
  return update('sellerSessions', session.id, {
    accessToken: token('sellerat', session.id),
    accessExpiresAt: new Date(mockNow() + ACCESS_TTL_MS).toISOString(),
    refreshToken: token('sellerrt', session.id),
    lastActiveAt: mockNowIso(),
  });
}

export function revokeSession(sessionId) {
  return update('sellerSessions', sessionId, { revokedAt: mockNowIso() });
}

function sessionIsLive(session) {
  if (!session || session.revokedAt) return false;
  return new Date(session.absoluteExpiresAt).getTime() > mockNow();
}

export function findSessionByRefresh(refreshToken) {
  const s = db.sellerSessions.find((x) => x.refreshToken === refreshToken);
  return sessionIsLive(s) ? s : null;
}

/** Resolves the caller from the Authorization header. */
export function resolveCaller(request) {
  const header = request.headers.get('Authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!bearer) return { error: 'missing' };

  const session = db.sellerSessions.find((s) => s.accessToken === bearer);
  if (!sessionIsLive(session)) return { error: 'invalid' };
  if (new Date(session.accessExpiresAt).getTime() <= mockNow()) return { error: 'expired' };

  const user = findById('sellerUsers', session.userId);
  if (!user) return { error: 'invalid' };
  if (user.status === 'SUSPENDED') return { error: 'inactive' };

  session.lastActiveAt = mockNowIso();
  return { user, session };
}

/** The seller record this user belongs to, or null. */
export function sellerFor(user) {
  return user?.sellerId ? findById('sellers', user.sellerId) : null;
}

/**
 * The session-shaped user object the seller UI stores. `accountStatus` and
 * `onboardingStep` drive the `RequireActiveSeller` gate; `defaultLanding`
 * sends an onboarding seller to the wizard rather than the dashboard.
 */
export function publicUser(user) {
  const seller = sellerFor(user);
  const onboarding = user.sellerId
    ? db.sellerOnboarding.find((o) => o.sellerId === user.sellerId) ?? null
    : null;
  const accountStatus = onboarding && onboarding.status !== 'APPROVED' ? onboarding.status : seller?.status ?? 'ONBOARDING';
  const onboardingComplete = accountStatus === 'ACTIVE' || accountStatus === 'APPROVED';

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarColor: user.avatarColor,
    status: user.status,
    sellerId: user.sellerId,
    storeName: seller?.storeName ?? user.storeName ?? 'Your store',
    tier: seller?.tier ?? null,
    rating: seller?.rating ?? null,
    roleKey: user.roleKey,
    roleName: user.roleName,
    permissions: user.permissions ?? [],
    accountStatus,
    onboardingStep: onboarding?.step ?? (onboardingComplete ? null : 0),
    onboardingComplete,
    mustChangePassword: Boolean(user.mustChangePassword),
    notifyEmail: user.notifyEmail ?? true,
    notifyInPanel: user.notifyInPanel ?? true,
    lastLoginAt: user.lastLoginAt ?? null,
    defaultLanding: onboardingComplete ? '/' : '/onboarding',
  };
}

export function sessionPayload(user, session) {
  return {
    user: publicUser(user),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.accessExpiresAt,
  };
}
