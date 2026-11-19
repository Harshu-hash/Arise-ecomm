import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { permissionsFromRoles, versionOf } from '../domain/services/accessRules.js';
import { Role } from '../infrastructure/persistence/role.model.js';
import { AuthSession } from '../infrastructure/persistence/session.model.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { issueInvite, reissueInvite } from './invite.service.js';
import { findRolesForAssignment } from './role.service.js';
import { revokeAllSessions, revokeSession } from './session.service.js';

const DEFAULT_LANDING = '/';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const activeSessionFilter = (userIds) => ({ userId: { $in: userIds }, revokedAt: null, expiresAt: { $gt: new Date() } });

// Never returns credentials, 2FA secrets, backup codes or invite token hashes.
function serializeAdminUser(user, { rolesById, activeSessions = 0 }) {
  const roles = (user.roleIds ?? []).map((id) => rolesById.get(id)).filter(Boolean);
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    status: user.status,
    roleIds: user.roleIds ?? [],
    roleNames: roles.map((role) => role.name),
    scope: user.scope ?? null,
    scopedBy: Array.from(new Set(roles.flatMap((role) => role.scopedBy))),
    twoFactorEnrolled: user.twoFactor?.enrolled ?? false,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    defaultLanding: user.defaultLanding ?? DEFAULT_LANDING,
    activeSessions,
    version: versionOf(user),
  };
}

async function serializeMany(users) {
  const roleIds = [...new Set(users.flatMap((user) => user.roleIds ?? []))];
  const userIds = users.map((user) => String(user._id));
  const [roles, sessions] = await Promise.all([
    Role.find({ _id: { $in: roleIds } }, 'name scopedBy').lean(),
    AuthSession.aggregate([{ $match: activeSessionFilter(userIds) }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
  ]);
  const rolesById = new Map(roles.map((role) => [String(role._id), role]));
  const counts = new Map(sessions.map((row) => [row._id, row.count]));
  return users.map((user) =>
    serializeAdminUser(user, { rolesById, activeSessions: counts.get(String(user._id)) ?? 0 }),
  );
}

const serializeOne = async (user) => (await serializeMany([user]))[0];

async function findAdmin(id) {
  const user = await User.findOne({ _id: id, role: ROLES.ADMIN }).lean();
  if (!user) throw new NotFoundError('That admin user no longer exists.');
  return user;
}

const range = (gte, lte) => ({ ...(gte ? { $gte: new Date(gte) } : {}), ...(lte ? { $lte: new Date(lte) } : {}) });

export async function listAdminUsers(query) {
  const base = { role: ROLES.ADMIN };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    base.$or = [{ name: pattern }, { email: pattern }];
  }
  if (query.roleId) base.roleIds = query.roleId;
  if (query.twoFactorEnrolled !== undefined) base['twoFactor.enrolled'] = query.twoFactorEnrolled;
  for (const field of ['createdAt', 'lastLoginAt']) {
    const bounds = range(query[`${field}[gte]`], query[`${field}[lte]`]);
    if (Object.keys(bounds).length) base[field] = bounds;
  }
  const filter = query.status.length ? { ...base, status: { $in: query.status } } : base;

  const [users, total, facets] = await Promise.all([
    User.find(filter)
      .sort({ [query.sortField]: query.sortDirection, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    User.countDocuments(filter),
    // Tab badges ignore the status filter so every tab keeps its own count.
    User.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return {
    data: await serializeMany(users),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { status: Object.fromEntries(facets.map((row) => [row._id, row.count])) },
    },
  };
}

function allowedActions(user, permissions) {
  const can = (key) => permissions.includes('*') || permissions.includes(key);
  const actions = [];
  if (can('admin.user.edit')) actions.push('EDIT');
  if (user.status === 'INVITED' && can('admin.user.invite')) actions.push('RESEND_INVITE');
  if (user.status === 'ACTIVE' && can('admin.user.deactivate')) actions.push('DEACTIVATE');
  if (user.status === 'DEACTIVATED' && can('admin.user.edit')) actions.push('REACTIVATE');
  if (can('admin.user.revoke_session')) actions.push('REVOKE_SESSIONS');
  return actions;
}

export async function getAdminUser(id, actorPermissions) {
  const user = await findAdmin(id);
  const sessions = await AuthSession.find(activeSessionFilter([id]), 'device createdAt lastUsedAt').sort({ lastUsedAt: -1 }).lean();
  const data = await serializeOne(user);
  return {
    data: { ...data, effectivePermissionCount: user.permissions?.includes('*') ? 'ALL' : (user.permissions?.length ?? 0) },
    meta: {
      allowedActions: allowedActions(user, actorPermissions),
      sessions: sessions.map((session) => ({
        id: String(session._id),
        device: session.device?.label ?? session.device?.userAgent ?? 'Unknown device',
        ip: session.device?.ip ?? null,
        createdAt: session.createdAt,
        lastActiveAt: session.lastUsedAt,
      })),
    },
  };
}

export async function inviteAdminUser({ name, email, roleIds, scope }, actor) {
  const roles = await findRolesForAssignment(roleIds);
  const result = await issueInvite({
    role: ROLES.ADMIN,
    email,
    name,
    permissions: permissionsFromRoles(roles),
    roleIds,
    scope,
  });
  const user = await findAdmin(result.userId);
  await recordAudit({
    action: 'admin.user.invite',
    subjectType: 'adminUser',
    subjectId: user._id,
    after: { email: user.email, roleIds },
    actor,
  });
  return { data: await serializeOne(user), devHint: result.devHint };
}

// The last active Super Admin must stay: losing it would lock everyone out of role management.
async function assertNotLastSuperAdmin(user) {
  if (!user.permissions?.includes('*') || user.status !== 'ACTIVE') return;
  const others = await User.countDocuments({ role: ROLES.ADMIN, status: 'ACTIVE', permissions: '*', _id: { $ne: user._id } });
  if (!others) throw new ConflictError('LAST_SUPER_ADMIN', 'At least one active Super Admin must remain.');
}

export async function updateAdminUser(id, { version, ...input }, actor) {
  const before = await findAdmin(id);
  if (version !== undefined && versionOf(before) !== version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this admin.', { current: await serializeOne(before) });
  }

  const patch = {};
  for (const field of ['name', 'scope', 'defaultLanding']) if (input[field] !== undefined) patch[field] = input[field];

  const currentRoleIds = [...(before.roleIds ?? [])].sort().join();
  if (input.roleIds && [...input.roleIds].sort().join() !== currentRoleIds) {
    if (String(before._id) === actor.userId) throw new ConflictError('SELF_ROLE_CHANGE', 'You cannot change your own roles.');
    const roles = await findRolesForAssignment(input.roleIds);
    patch.roleIds = input.roleIds;
    patch.permissions = permissionsFromRoles(roles);
    if (!patch.permissions.includes('*')) await assertNotLastSuperAdmin(before);
  }
  if (!Object.keys(patch).length) return serializeOne(before);

  const updated = await User.findOneAndUpdate({ _id: id, updatedAt: before.updatedAt }, { $set: patch }, { new: true }).lean();
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this admin.');

  await recordAudit({
    action: patch.roleIds ? 'admin.user.roles_changed' : 'admin.user.edit',
    subjectType: 'adminUser',
    subjectId: id,
    before: { name: before.name, roleIds: before.roleIds, scope: before.scope, defaultLanding: before.defaultLanding },
    after: { name: updated.name, roleIds: updated.roleIds, scope: updated.scope, defaultLanding: updated.defaultLanding },
    actor,
  });
  return serializeOne(updated);
}

// One status transition: guarded by the expected current status so concurrent clicks cannot double-apply.
async function transition(id, { from, to, conflict, set = {}, action, reason = null, actor }) {
  const before = await findAdmin(id);
  if (before.status !== from) throw new ConflictError(...conflict);
  const updated = await User.findOneAndUpdate({ _id: id, status: from }, { $set: { status: to, ...set } }, { new: true }).lean();
  if (!updated) throw new ConflictError(...conflict);
  await recordAudit({ action, subjectType: 'adminUser', subjectId: id, before: { status: from }, after: { status: to }, reason, actor });
  return updated;
}

export async function deactivateAdminUser(id, { reason }, actor) {
  if (id === actor.userId) throw new ConflictError('SELF_DEACTIVATE', 'You cannot deactivate your own account.');
  await assertNotLastSuperAdmin(await findAdmin(id));
  const user = await transition(id, {
    from: 'ACTIVE',
    to: 'DEACTIVATED',
    conflict: ['NOT_ACTIVE', 'Only active accounts can be deactivated.'],
    action: 'admin.user.deactivate',
    reason,
    actor,
  });
  const sessionsRevoked = await revokeAllSessions(id);
  return { data: await serializeOne(user), sessionsRevoked };
}

export async function reactivateAdminUser(id, actor) {
  const user = await transition(id, {
    from: 'DEACTIVATED',
    to: 'ACTIVE',
    conflict: ['NOT_DEACTIVATED', 'That account is not deactivated.'],
    set: { mustChangePassword: true },
    action: 'admin.user.reactivate',
    actor,
  });
  return serializeOne(user);
}

export async function resendAdminInvite(id, actor) {
  const user = await User.findOne({ _id: id, role: ROLES.ADMIN });
  if (!user) throw new NotFoundError('That admin user no longer exists.');
  if (user.status !== 'INVITED') throw new ConflictError('NOT_INVITED', 'That invitation has already been accepted.');
  const result = await reissueInvite(user);
  await recordAudit({ action: 'admin.user.resend_invite', subjectType: 'adminUser', subjectId: id, actor });
  return { data: await serializeOne(user.toObject()), devHint: result.devHint };
}

export async function revokeAdminSessions(id, { sessionId }, actor) {
  await findAdmin(id);
  const revoked = sessionId ? await revokeSession(sessionId, id) : await revokeAllSessions(id);
  if (sessionId && !revoked) throw new NotFoundError('That session no longer exists.');
  await recordAudit({ action: 'admin.user.revoke_sessions', subjectType: 'adminUser', subjectId: id, after: { revoked }, actor });
  return { revoked };
}
