import { ForbiddenError } from '../errors/AppError.js';
import { User } from '../../modules/identity/infrastructure/persistence/user.model.js';

// Marks a middleware (or a handler that checks permissions itself) as a permission guard, so test/adminRouteGuards.test.js
// can prove every admin route has one. A new admin route without a guard fails that test.
export const markPermissionGuard = (fn) => Object.assign(fn, { isPermissionGuard: true });

// Admin permissions are resolved (not pattern-based) and can change between an admin's
// requests, so they are read fresh here rather than carried in the access token.
export async function userHasPermission(userId, key) {
  const user = await User.findById(userId, 'permissions').lean();
  const permissions = user?.permissions ?? [];
  return permissions.includes('*') || permissions.includes(key);
}

// Mount after `authenticate`: passes when the admin holds at least one of the keys (e.g. a picker shared by two screens).
export function requireAnyPermission(...keys) {
  return markPermissionGuard(async (req, _res, next) => {
    try {
      const results = await Promise.all(keys.map((key) => userHasPermission(req.auth?.userId, key)));
      if (!results.some(Boolean)) throw new ForbiddenError();
      next();
    } catch (error) {
      next(error);
    }
  });
}

// Mount after `authenticate`. A wildcard ('*', super_admin) passes every check.
export function requirePermission(key) {
  return markPermissionGuard(async (req, _res, next) => {
    try {
      if (!(await userHasPermission(req.auth?.userId, key))) throw new ForbiddenError();
      next();
    } catch (error) {
      next(error);
    }
  });
}

// Like requirePermission, for routes whose key depends on the request (e.g. the decision in the URL). `keysOf(req)` returns one
// key or a list (any one passes); nothing returned means no key applies, which denies.
export function requirePermissionBy(keysOf) {
  return markPermissionGuard(async (req, _res, next) => {
    try {
      const keys = [keysOf(req)].flat().filter(Boolean);
      const results = await Promise.all(keys.map((key) => userHasPermission(req.auth?.userId, key)));
      if (!results.some(Boolean)) throw new ForbiddenError();
      next();
    } catch (error) {
      next(error);
    }
  });
}
