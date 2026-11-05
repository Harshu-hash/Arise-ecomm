import { http as mswHttp } from 'msw';
import { db, filter, findById, id, insert, remove, update } from '@mocks/db/store';
import { writeAudit } from '@mocks/engine/audit';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, conflict, created, forbidden, notFound, ok, unauthorized } from '@mocks/engine/respond';
import { publicUser, resolveCaller, revokeSession } from '@seller/mocks/engine/sellerAuth';
import { SELLER_PERMISSION_KEYS, SELLER_ROLE_TEMPLATES } from '@seller/rbac/permissions';
import { SELLER_BASE } from './auth';

const EVENT_KEYS = ['orders', 'fulfilment_sla', 'returns', 'listings_qc', 'inventory', 'payouts', 'account_health', 'ads', 'security'];
const CHANNELS = ['inPanel', 'email', 'sms', 'whatsapp', 'push'];
const WEBHOOK_EVENTS = ['order.created', 'order.updated', 'inventory.changed', 'return.updated', 'payout.completed'];

function context(request, permission) {
  const result = resolveCaller(request);
  if (result.error) return { response: unauthorized() };
  const permissions = new Set(result.user.permissions ?? []);
  if (permission && !permissions.has('*') && !permissions.has(permission)) return { response: forbidden('Your seller role does not permit this action.') };
  return result;
}

function stepUp(request, user) {
  const token = request.headers.get('X-Step-Up-Token');
  const challenge = db.sellerStepUpChallenges.find((row) => row.token === token && row.userId === user.id && !row.usedAt && new Date(row.expiresAt).getTime() > mockNow());
  if (!challenge) return { response: forbidden('Confirm your password to continue.', { details: { stepUpRequired: true } }) };
  update('sellerStepUpChallenges', challenge.id, { usedAt: mockNowIso() });
  return { challenge };
}

function securityEvent(user, type, description) {
  return insert('sellerSecurityEvents', { id: id('SEVT', 7), sellerId: user.sellerId, userId: user.id, type, description, at: mockNowIso(), ip: '103.21.58.14', city: 'Ahmedabad, GJ' });
}

function roleRows(sellerId) {
  return [
    ...SELLER_ROLE_TEMPLATES.map((row) => ({ ...row, id: `template:${row.key}`, template: true })),
    ...filter('sellerRoles', (row) => row.sellerId === sellerId),
  ];
}

function ownRole(user, roleId) { const role = findById('sellerRoles', roleId); return role?.sellerId === user.sellerId ? role : null; }
function ownWebhook(user, webhookId) { const row = findById('sellerWebhooks', webhookId); return row?.sellerId === user.sellerId ? row : null; }
function ownKey(user, keyId) { const row = findById('sellerApiKeys', keyId); return row?.sellerId === user.sellerId ? row : null; }

function notificationPolicy(user) {
  let policy = db.sellerNotificationPolicies.find((row) => row.userId === user.id);
  if (!policy) policy = insert('sellerNotificationPolicies', { id: id('SNP', 6), sellerId: user.sellerId, userId: user.id, matrix: Object.fromEntries(EVENT_KEYS.map((event) => [event, Object.fromEntries(CHANNELS.map((channel) => [channel, event === 'security' ? ['inPanel', 'email'].includes(channel) : ['inPanel', 'email'].includes(channel)]))])), quietHours: { enabled: false, from: '22:00', to: '07:00', timezone: 'Asia/Kolkata' }, escalationContacts: [], version: 1 });
  return policy;
}

const audit = (user, action, entityType, entityId, entityLabel, reason, metadata) => writeAudit({ actor: user, action, entityType, entityId, entityLabel, reason, metadata: { sellerId: user.sellerId, ...metadata } });

export const sellerSecurityHandlers = [
  mswHttp.post(`${SELLER_BASE}/settings/security/reauth`, async ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    const body = await request.json();
    if (body?.password !== c.user.password) return unauthorized('Password is incorrect.');
    const row = insert('sellerStepUpChallenges', { id: id('STEP', 6), sellerId: c.user.sellerId, userId: c.user.id, token: `step_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`, expiresAt: new Date(mockNow() + 5 * 60_000).toISOString(), usedAt: null, createdAt: mockNowIso() });
    securityEvent(c.user, 'STEP_UP', 'Sensitive action re-authentication completed.'); scheduleSave();
    return ok({ token: row.token, expiresAt: row.expiresAt });
  }),

  mswHttp.get(`${SELLER_BASE}/settings/security`, async ({ request }) => {
    const c = context(request, 'security.session.view'); if (c.response) return c.response;
    const sessions = filter('sellerSessions', (row) => row.userId === c.user.id && !row.revokedAt).map((row) => ({ id: row.id, device: row.device, ip: row.ip, city: row.city, createdAt: row.createdAt, lastActiveAt: row.lastActiveAt, current: row.id === c.session.id }));
    const events = filter('sellerSecurityEvents', (row) => row.sellerId === c.user.sellerId && row.userId === c.user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
    return ok({ twoFactorEnrolled: c.user.twoFactorEnrolled, backupCodesRemaining: (c.user.backupCodes ?? []).filter((row) => !row.usedAt).length, passwordChangedAt: c.user.passwordChangedAt ?? c.user.createdAt, recoveryEmail: c.user.email.replace(/^(.{2}).*(@.*)$/, '$1•••••$2'), sessions, events });
  }),

  mswHttp.post(`${SELLER_BASE}/settings/security/backup-codes`, async ({ request }) => {
    const c = context(request, 'security.session.revoke'); if (c.response) return c.response;
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const codes = Array.from({ length: 8 }, () => `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase());
    update('sellerUsers', c.user.id, { backupCodes: codes.map((code) => ({ code, usedAt: null })) }); securityEvent(c.user, 'BACKUP_CODES', 'Backup codes regenerated.'); audit(c.user, 'security.backup_codes.regenerate', 'sellerUser', c.user.id, c.user.name); scheduleSave();
    return ok({ codes });
  }),

  mswHttp.post(`${SELLER_BASE}/settings/security/2fa/replace`, async ({ request }) => {
    const c = context(request, 'security.session.revoke'); if (c.response) return c.response;
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const secret = `ARISE${Math.random().toString(36).slice(2, 14).toUpperCase()}`;
    update('sellerUsers', c.user.id, { twoFactorSecret: secret, twoFactorEnrolled: false }); securityEvent(c.user, 'TWO_FACTOR_REPLACED', 'Authenticator replacement started.'); scheduleSave();
    return ok({ secret, otpauthUrl: `otpauth://totp/Arise%20Seller:${encodeURIComponent(c.user.email)}?secret=${secret}&issuer=Arise%20Seller` });
  }),

  mswHttp.delete(`${SELLER_BASE}/settings/security/sessions/:id`, async ({ request, params }) => {
    const c = context(request, 'security.session.revoke'); if (c.response) return c.response;
    const session = findById('sellerSessions', params.id); if (!session || session.userId !== c.user.id) return notFound('Session not found.');
    if (session.id === c.session.id) return badRequest('Use sign out to end the current session.', 'CURRENT_SESSION');
    revokeSession(session.id); securityEvent(c.user, 'SESSION_REVOKED', `Session revoked: ${session.device}.`); scheduleSave(); return ok({ revoked: true });
  }),

  mswHttp.post(`${SELLER_BASE}/settings/security/sign-out-all`, async ({ request }) => {
    const c = context(request, 'security.session.revoke'); if (c.response) return c.response;
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    filter('sellerSessions', (row) => row.userId === c.user.id && row.id !== c.session.id && !row.revokedAt).forEach((row) => revokeSession(row.id)); securityEvent(c.user, 'SIGN_OUT_ALL', 'All other sessions were signed out.'); scheduleSave(); return ok({ currentSessionPreserved: true });
  }),

  mswHttp.get(`${SELLER_BASE}/settings/audit`, async ({ request }) => {
    const c = context(request, 'security.audit.view'); if (c.response) return c.response;
    return ok(filter('auditEvents', (row) => row.metadata?.sellerId === c.user.sellerId || db.sellerUsers.some((user) => user.sellerId === c.user.sellerId && user.id === row.actorId)).sort((a, b) => b.at.localeCompare(a.at)));
  }),

  mswHttp.get(`${SELLER_BASE}/settings/roles`, async ({ request }) => { const c = context(request, 'security.role.view'); return c.response ?? ok(roleRows(c.user.sellerId)); }),
  mswHttp.post(`${SELLER_BASE}/settings/roles`, async ({ request }) => {
    const c = context(request, 'security.role.manage'); if (c.response) return c.response;
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const body = await request.json(); const permissions = [...new Set(body?.permissions ?? [])].filter((key) => SELLER_PERMISSION_KEYS.includes(key));
    if (!body?.name?.trim() || !permissions.length || permissions.includes('*')) return badRequest('Add a role name and safe permissions.', 'ROLE_INVALID');
    if (permissions.some((key) => key.startsWith('security.'))) return forbidden('A custom role cannot grant security administration.');
    const role = insert('sellerRoles', { id: id('SROLE', 6), sellerId: c.user.sellerId, name: body.name.trim(), description: body.description ?? '', permissions, system: false, createdAt: mockNowIso(), version: 1 });
    audit(c.user, 'seller_role.create', 'sellerRole', role.id, role.name); scheduleSave(); return created(role);
  }),
  mswHttp.patch(`${SELLER_BASE}/settings/roles/:id`, async ({ request, params }) => {
    const c = context(request, 'security.role.manage'); if (c.response) return c.response;
    const role = ownRole(c.user, params.id); if (!role) return notFound('Custom role not found.');
    const body = await request.json(); const permissions = [...new Set(body?.permissions ?? role.permissions)].filter((key) => SELLER_PERMISSION_KEYS.includes(key));
    if (permissions.some((key) => key.startsWith('security.'))) return forbidden('Privilege escalation is not allowed.');
    update('sellerRoles', role.id, { name: body.name ?? role.name, description: body.description ?? role.description, permissions });
    filter('sellerUsers', (row) => row.sellerId === c.user.sellerId && row.roleKey === role.id).forEach((row) => update('sellerUsers', row.id, { permissions })); audit(c.user, 'seller_role.update', 'sellerRole', role.id, role.name); scheduleSave(); return ok(findById('sellerRoles', role.id));
  }),
  mswHttp.delete(`${SELLER_BASE}/settings/roles/:id`, async ({ request, params }) => {
    const c = context(request, 'security.role.manage'); if (c.response) return c.response;
    const role = ownRole(c.user, params.id); if (!role) return notFound('Custom role not found.');
    if (db.sellerUsers.some((row) => row.sellerId === c.user.sellerId && row.roleKey === role.id && row.status === 'ACTIVE')) return conflict('Reassign active users before deleting this role.', 'ROLE_IN_USE');
    remove('sellerRoles', role.id); audit(c.user, 'seller_role.delete', 'sellerRole', role.id, role.name); scheduleSave(); return ok({ deleted: true });
  }),

  mswHttp.patch(`${SELLER_BASE}/settings/users/:id`, async ({ request, params }) => {
    const c = context(request, 'settings.user.manage'); if (c.response) return c.response;
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const target = findById('sellerUsers', params.id); if (!target || target.sellerId !== c.user.sellerId) return notFound('User not found.');
    if (target.id === c.user.id) return conflict('You cannot change your own role or access state.', 'SELF_REVOCATION');
    const body = await request.json(); const role = roleRows(c.user.sellerId).find((row) => row.id === body.roleKey || row.key === body.roleKey);
    if (body.roleKey && (!role || role.key === 'owner')) return forbidden('Only an ownership transfer can assign the owner role.');
    const patch = {};
    if (role) Object.assign(patch, { roleKey: role.id ?? role.key, roleName: role.name, permissions: role.permissions });
    if (['ACTIVE', 'DEACTIVATED'].includes(body.status)) patch.status = body.status;
    update('sellerUsers', target.id, patch); audit(c.user, 'seller_user.update', 'sellerUser', target.id, target.name); scheduleSave(); return ok(publicUser(findById('sellerUsers', target.id)));
  }),
  mswHttp.post(`${SELLER_BASE}/settings/users/:id/:action`, async ({ request, params }) => {
    const c = context(request, 'settings.user.manage'); if (c.response) return c.response;
    const target = findById('sellerUsers', params.id); if (!target || target.sellerId !== c.user.sellerId) return notFound('User not found.');
    if (params.action === 'revoke' && target.roleKey === 'owner') return badRequest('The account owner cannot be removed.', 'CANNOT_REVOKE');
    if (target.id === c.user.id) return conflict('You cannot change your own access.', 'SELF_REVOCATION');
    if (params.action === 'revoke') {
      update('sellerUsers', target.id, { status: 'DEACTIVATED', inviteToken: null, deactivatedAt: mockNowIso() });
      audit(c.user, 'seller_user.revoke', 'sellerUser', target.id, target.name); scheduleSave();
      return ok(publicUser(findById('sellerUsers', target.id)));
    }
    if (params.action === 'transfer-ownership') {
      if (c.user.roleKey !== 'owner' || target.status !== 'ACTIVE') return forbidden('Only the current owner can transfer ownership to an active team member.');
      const verified = stepUp(request, c.user); if (verified.response) return verified.response;
      const admin = SELLER_ROLE_TEMPLATES.find((row) => row.key === 'admin'); update('sellerUsers', c.user.id, { roleKey: 'admin', roleName: admin.name, permissions: admin.permissions }); update('sellerUsers', target.id, { roleKey: 'owner', roleName: 'Account Owner', permissions: ['*'] }); audit(c.user, 'seller_owner.transfer', 'sellerUser', target.id, target.name); scheduleSave(); return ok({ previousOwner: publicUser(findById('sellerUsers', c.user.id)), owner: publicUser(findById('sellerUsers', target.id)) });
    }
    if (params.action === 'resend-invite' && target.status === 'INVITED') { update('sellerUsers', target.id, { inviteToken: `invite_${id('TOK', 6)}`, invitedAt: mockNowIso() }); scheduleSave(); return ok(target); }
    if (params.action === 'cancel-invite' && target.status === 'INVITED') { update('sellerUsers', target.id, { status: 'DEACTIVATED', inviteToken: null }); scheduleSave(); return ok(target); }
    return badRequest('That action is not available.', 'ILLEGAL_TRANSITION');
  }),
  mswHttp.post(`${SELLER_BASE}/settings/users/:id/transfer-ownership`, async ({ request, params }) => {
    const c = context(request, 'security.role.manage'); if (c.response) return c.response;
    if (c.user.roleKey !== 'owner') return forbidden('Only the current owner can transfer ownership.');
    const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const target = findById('sellerUsers', params.id); if (!target || target.sellerId !== c.user.sellerId || target.status !== 'ACTIVE') return notFound('Choose an active team member.');
    const admin = SELLER_ROLE_TEMPLATES.find((row) => row.key === 'admin'); update('sellerUsers', c.user.id, { roleKey: 'admin', roleName: admin.name, permissions: admin.permissions }); update('sellerUsers', target.id, { roleKey: 'owner', roleName: 'Account Owner', permissions: ['*'] }); audit(c.user, 'seller_owner.transfer', 'sellerUser', target.id, target.name); scheduleSave(); return ok({ previousOwner: publicUser(findById('sellerUsers', c.user.id)), owner: publicUser(findById('sellerUsers', target.id)) });
  }),

  mswHttp.get(`${SELLER_BASE}/settings/notification-policy`, async ({ request }) => { const c = context(request, 'settings.notification.manage'); return c.response ?? ok(notificationPolicy(c.user)); }),
  mswHttp.patch(`${SELLER_BASE}/settings/notification-policy`, async ({ request }) => {
    const c = context(request, 'settings.notification.manage'); if (c.response) return c.response;
    const policy = notificationPolicy(c.user); const body = await request.json(); const matrix = { ...policy.matrix, ...(body.matrix ?? {}) };
    matrix.security = { ...matrix.security, inPanel: true, email: true };
    update('sellerNotificationPolicies', policy.id, { matrix, quietHours: body.quietHours ?? policy.quietHours, escalationContacts: body.escalationContacts ?? policy.escalationContacts }); scheduleSave(); return ok(findById('sellerNotificationPolicies', policy.id));
  }),

  mswHttp.get(`${SELLER_BASE}/settings/integrations`, async ({ request }) => { const c = context(request, 'security.webhook.view'); return c.response ?? ok([{ key: 'ERP', name: 'ERP / OMS', status: db.sellerWebhooks.some((row) => row.sellerId === c.user.sellerId) ? 'CONNECTED' : 'AVAILABLE' }, { key: 'WMS', name: 'Warehouse management', status: 'AVAILABLE' }]); }),
  mswHttp.get(`${SELLER_BASE}/settings/api-keys`, async ({ request }) => { const c = context(request, 'security.api_key.view'); return c.response ?? ok(filter('sellerApiKeys', (row) => row.sellerId === c.user.sellerId).map(({ secretHash: _secretHash, ...row }) => row)); }),
  mswHttp.post(`${SELLER_BASE}/settings/api-keys`, async ({ request }) => {
    const c = context(request, 'security.api_key.create'); if (c.response) return c.response; const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const body = await request.json(); const scopes = [...new Set(body?.scopes ?? [])].filter((scope) => SELLER_PERMISSION_KEYS.includes(scope) && !scope.startsWith('security.'));
    if (!body?.name?.trim() || !scopes.length) return badRequest('Add a key name and at least one safe scope.', 'API_KEY_INVALID');
    const secret = `ars_live_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; const row = insert('sellerApiKeys', { id: id('SAK', 6), sellerId: c.user.sellerId, name: body.name.trim(), prefix: secret.slice(0, 14), secretHash: `digest_${id('HASH', 16)}`, scopes, status: 'ACTIVE', createdBy: c.user.id, createdAt: mockNowIso(), lastUsedAt: null, version: 1 }); audit(c.user, 'api_key.create', 'sellerApiKey', row.id, row.name); scheduleSave(); return created({ ...row, secret, secretHash: undefined });
  }),
  mswHttp.post(`${SELLER_BASE}/settings/api-keys/:id/:action`, async ({ request, params }) => {
    const c = context(request, params.action === 'revoke' ? 'security.api_key.revoke' : 'security.api_key.rotate'); if (c.response) return c.response; const verified = stepUp(request, c.user); if (verified.response) return verified.response;
    const key = ownKey(c.user, params.id); if (!key) return notFound('API key not found.');
    if (params.action === 'revoke') { update('sellerApiKeys', key.id, { status: 'REVOKED', revokedAt: mockNowIso() }); audit(c.user, 'api_key.revoke', 'sellerApiKey', key.id, key.name); scheduleSave(); return ok({ ...findById('sellerApiKeys', key.id), secretHash: undefined }); }
    if (params.action !== 'rotate') return badRequest('Unknown API-key action.');
    const secret = `ars_live_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; update('sellerApiKeys', key.id, { prefix: secret.slice(0, 14), secretHash: `digest_${id('HASH', 16)}`, rotatedAt: mockNowIso() }); audit(c.user, 'api_key.rotate', 'sellerApiKey', key.id, key.name); scheduleSave(); return ok({ ...findById('sellerApiKeys', key.id), secret, secretHash: undefined });
  }),

  mswHttp.get(`${SELLER_BASE}/settings/webhooks`, async ({ request }) => { const c = context(request, 'security.webhook.view'); return c.response ?? ok(filter('sellerWebhooks', (row) => row.sellerId === c.user.sellerId).map(({ secretHash: _secretHash, ...row }) => ({ ...row, deliveries: filter('sellerWebhookDeliveries', (delivery) => delivery.webhookId === row.id).slice(0, 20) }))); }),
  mswHttp.post(`${SELLER_BASE}/settings/webhooks`, async ({ request }) => {
    const c = context(request, 'security.webhook.manage'); if (c.response) return c.response; const body = await request.json();
    if (!/^https:\/\//.test(body?.url ?? '')) return badRequest('Webhook endpoints must use HTTPS.', 'WEBHOOK_INVALID'); const events = (body.events ?? []).filter((event) => WEBHOOK_EVENTS.includes(event)); if (!events.length) return badRequest('Choose at least one event.', 'WEBHOOK_INVALID');
    const secret = `whsec_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; const row = insert('sellerWebhooks', { id: id('SWH', 6), sellerId: c.user.sellerId, url: body.url, events, status: 'ACTIVE', secretHash: `digest_${id('HASH', 16)}`, secretPrefix: secret.slice(0, 12), createdAt: mockNowIso(), version: 1 }); insert('sellerWebhookDeliveries', { id: id('SWD', 7), webhookId: row.id, event: events[0], status: 'FAILED', responseStatus: 503, attempts: 1, payload: { id: 'evt_demo', type: events[0] }, lastAttemptAt: mockNowIso() }); audit(c.user, 'webhook.create', 'sellerWebhook', row.id, row.url); scheduleSave(); return created({ ...row, secret, secretHash: undefined });
  }),
  mswHttp.post(`${SELLER_BASE}/settings/webhooks/:id/rotate-secret`, async ({ request, params }) => {
    const c = context(request, 'security.webhook.manage'); if (c.response) return c.response; const verified = stepUp(request, c.user); if (verified.response) return verified.response; const webhook = ownWebhook(c.user, params.id); if (!webhook) return notFound('Webhook not found.');
    const secret = `whsec_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; update('sellerWebhooks', webhook.id, { secretHash: `digest_${id('HASH', 16)}`, secretPrefix: secret.slice(0, 12), rotatedAt: mockNowIso() }); audit(c.user, 'webhook.secret.rotate', 'sellerWebhook', webhook.id, webhook.url); scheduleSave(); return ok({ ...findById('sellerWebhooks', webhook.id), secret, secretHash: undefined });
  }),
  mswHttp.post(`${SELLER_BASE}/settings/webhook-deliveries/:id/retry`, async ({ request, params }) => {
    const c = context(request, 'security.webhook.retry'); if (c.response) return c.response; const delivery = findById('sellerWebhookDeliveries', params.id); const webhook = delivery ? ownWebhook(c.user, delivery.webhookId) : null; if (!webhook) return notFound('Delivery not found.');
    update('sellerWebhookDeliveries', delivery.id, { status: 'DELIVERED', responseStatus: 200, attempts: (delivery.attempts ?? 0) + 1, lastAttemptAt: mockNowIso() }); audit(c.user, 'webhook.delivery.retry', 'sellerWebhookDelivery', delivery.id, delivery.event); scheduleSave(); return ok(findById('sellerWebhookDeliveries', delivery.id));
  }),
];
