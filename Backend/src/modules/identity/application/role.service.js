import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { PERMISSION_KEYS } from '../../../shared/rbac/permissionCatalog.js';
import { normalizePermissions, permissionsFromRoles, roleKeyOf, versionOf } from '../domain/services/accessRules.js';
import { Role } from '../infrastructure/persistence/role.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const NAME_TAKEN = { name: ['A role with this name already exists.'] };
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function serializeRole(row, userCount = 0) {
  return {
    id: String(row._id),
    key: row.key,
    name: row.name,
    description: row.description ?? '',
    system: row.system,
    scopedBy: row.scopedBy,
    permissions: row.permissions,
    permissionCount: row.permissions.includes('*') ? 'ALL' : row.permissions.length,
    userCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: versionOf(row),
  };
}

async function adminCountsByRole(roleIds) {
  const rows = await User.aggregate([
    { $match: { role: ROLES.ADMIN, roleIds: { $in: roleIds } } },
    { $unwind: '$roleIds' },
    { $match: { roleIds: { $in: roleIds } } },
    { $group: { _id: '$roleIds', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}

// Roles are admin-defined and few (tens), so filter/sort/paginate happen after one indexed read
// plus one grouped count; userCount and permissionCount are derived, so they cannot be Mongo sorts.
// shortcut: in-memory paging, move to an aggregation if roles ever reach the thousands.
const SORT_VALUE = {
  name: (row) => row.name.toLowerCase(),
  userCount: (row) => row.userCount,
  updatedAt: (row) => row.updatedAt.getTime(),
  permissionCount: (row) => (row.permissionCount === 'ALL' ? Infinity : row.permissionCount),
};

export async function listRoles({ page, pageSize, q, system, hasUsers, sortField, sortDirection }) {
  const filter = {};
  if (system !== undefined) filter.system = system;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }, { key: pattern }];
  }
  const roles = await Role.find(filter).lean();
  const counts = await adminCountsByRole(roles.map((role) => String(role._id)));
  let rows = roles.map((role) => serializeRole(role, counts.get(String(role._id)) ?? 0));
  if (hasUsers !== undefined) rows = rows.filter((row) => (row.userCount > 0) === hasUsers);

  const value = SORT_VALUE[sortField] ?? SORT_VALUE.name;
  rows.sort((a, b) => (value(a) > value(b) ? 1 : value(a) < value(b) ? -1 : 0) * sortDirection);

  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) },
  };
}

async function findRole(id) {
  const role = await Role.findById(id).lean();
  if (!role) throw new NotFoundError('That role no longer exists.');
  return role;
}

export async function getRole(id) {
  const role = await findRole(id);
  const users = await User.find({ role: ROLES.ADMIN, roleIds: id }, 'name email status').limit(50).lean();
  return {
    data: serializeRole(role, users.length),
    meta: {
      allowedActions: role.system ? ['CLONE'] : ['EDIT', 'CLONE', 'DELETE'],
      users: users.map((user) => ({ id: String(user._id), name: user.name, email: user.email, status: user.status })),
    },
  };
}

// Loads roles for an assignment; every id must exist or the whole assignment is refused.
export async function findRolesForAssignment(roleIds) {
  const roles = await Role.find({ _id: { $in: roleIds } }).lean();
  if (roles.length !== new Set(roleIds).size) {
    throw new ValidationError('One or more roles do not exist.', { roleIds: ['One of those roles no longer exists.'] });
  }
  return roles;
}

// Role permissions are materialised onto each holder (see permission middleware), so a role
// edit must refresh every admin that holds it. Idempotent: a retry after a partial failure heals it.
async function syncHolders(roleId) {
  const holders = await User.find({ role: ROLES.ADMIN, roleIds: roleId }, 'roleIds').lean();
  if (!holders.length) return;
  const roles = await Role.find({ _id: { $in: [...new Set(holders.flatMap((user) => user.roleIds))] } }, 'permissions').lean();
  const byId = new Map(roles.map((role) => [String(role._id), role]));
  await User.bulkWrite(
    holders.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { permissions: permissionsFromRoles(user.roleIds.map((id) => byId.get(id)).filter(Boolean)) } },
      },
    })),
  );
}

async function assertNameFree(name, exceptId = null) {
  const clash = await Role.exists({
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new ValidationError('A role with this name already exists.', NAME_TAKEN);
}

async function insertRole({ name, description, scopedBy, permissions }, actor, auditExtra = {}) {
  const key = roleKeyOf(name);
  if (!key) throw new ValidationError('Invalid role name.', { name: ['Use letters or numbers in the name.'] });
  await assertNameFree(name);
  let row;
  try {
    row = await Role.create({ key, name, description, scopedBy, permissions, system: false });
  } catch (error) {
    if (error?.code === 11000) throw new ValidationError('A role with this name already exists.', NAME_TAKEN);
    throw error;
  }
  const result = serializeRole(row.toObject());
  await recordAudit({ action: 'admin.role.create', subjectType: 'role', subjectId: row._id, after: { ...result, ...auditExtra }, actor });
  return result;
}

export const createRole = (input, actor) =>
  insertRole({ ...input, permissions: normalizePermissions(input.permissions) }, actor);

export async function cloneRole(id, input, actor) {
  const source = await findRole(id);
  return insertRole(
    {
      name: input.name ?? `${source.name} (copy)`,
      description: input.description ?? source.description ?? '',
      scopedBy: source.scopedBy,
      // Cloning Super Admin materialises its wildcard so the copy can be narrowed in the matrix.
      permissions: source.permissions.includes('*') ? PERMISSION_KEYS : source.permissions,
    },
    actor,
    { clonedFrom: id },
  );
}

export async function updateRole(id, { version, ...input }, actor) {
  const before = await findRole(id);
  if (before.system) throw new ConflictError('ROLE_IS_SYSTEM', 'System roles cannot be edited. Clone this role to customise it.');
  if (versionOf(before) !== version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this role.', { current: serializeRole(before) });
  }
  if (input.name !== undefined) await assertNameFree(input.name, id);

  const patch = { ...input, ...(input.permissions ? { permissions: normalizePermissions(input.permissions) } : {}) };
  const updated = await Role.findOneAndUpdate({ _id: id, updatedAt: before.updatedAt }, { $set: patch }, { new: true }).lean();
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this role.');
  if (patch.permissions) await syncHolders(id);

  const result = serializeRole(updated, (await adminCountsByRole([id])).get(id) ?? 0);
  await recordAudit({
    action: 'admin.role.edit',
    subjectType: 'role',
    subjectId: id,
    before: serializeRole(before),
    after: result,
    actor,
  });
  return result;
}

export async function deleteRole(id, actor) {
  const role = await findRole(id);
  if (role.system) throw new ConflictError('ROLE_IS_SYSTEM', 'System roles cannot be deleted.');
  const holders = await User.find({ role: ROLES.ADMIN, roleIds: id }, 'name').limit(10).lean();
  if (holders.length) {
    throw new ConflictError('ROLE_IN_USE', 'Admins still use this role. Reassign them first.', {
      users: holders.map((user) => ({ id: String(user._id), name: user.name })),
    });
  }
  await Role.deleteOne({ _id: id, system: false });
  await recordAudit({ action: 'admin.role.delete', subjectType: 'role', subjectId: id, before: serializeRole(role), actor });
  return { id };
}
