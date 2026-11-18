import { ValidationError } from '../../../../shared/errors/AppError.js';
import { PERMISSION_KEYS, expandImplied, isValidPermission } from '../../../../shared/rbac/permissionCatalog.js';

// Optimistic-concurrency token for roles and admin users: changes on every write, no extra column.
export const versionOf = (doc) => doc.updatedAt.getTime();

export const roleKeyOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// A user's effective permissions are the union of their roles; any '*' role makes it '*'.
export function permissionsFromRoles(roles) {
  return roles.some((role) => role.permissions.includes('*'))
    ? ['*']
    : Array.from(new Set(roles.flatMap((role) => role.permissions)));
}

// A custom role never stores the wildcard (only the seeded Super Admin does): the editor shows '*'
// as "everything on", so it is saved as every explicit key and can later be narrowed.
export function normalizePermissions(keys) {
  if (keys.includes('*')) return PERMISSION_KEYS;
  const unknown = keys.filter((key) => !isValidPermission(key));
  if (unknown.length) {
    throw new ValidationError('Invalid permissions.', { permissions: [`Unknown permissions: ${unknown.slice(0, 3).join(', ')}`] });
  }
  return expandImplied(keys);
}
