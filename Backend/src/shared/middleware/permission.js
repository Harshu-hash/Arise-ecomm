import { ForbiddenError } from '../errors/AppError.js';
import { User } from '../../modules/identity/infrastructure/persistence/user.model.js';

// Admin permissions are resolved (not pattern-based) and can change between an admin's
// requests, so they are read fresh here rather than carried in the access token.
export async function userHasPermission(userId, key) {
  const user = await User.findById(userId, 'permissions').lean();
  const permissions = user?.permissions ?? [];
  return permissions.includes('*') || permissions.includes(key);
}

// Mount after `authenticate`. A wildcard ('*', super_admin) passes every check.
export function requirePermission(key) {
  return async (req, _res, next) => {
    try {
      if (!(await userHasPermission(req.auth?.userId, key))) throw new ForbiddenError();
      next();
    } catch (error) {
      next(error);
    }
  };
}
