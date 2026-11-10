import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import { enrichRequestContext } from '../http/requestContext.js';
import { verifyAccessToken } from '../utils/jwt.js';

export function authenticate(req, _res, next) {
  try {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, role: claims.role, sellerId: claims.sellerId ?? null };
    enrichRequestContext({ actorId: req.auth.userId, sellerId: req.auth.sellerId });
    next();
  } catch (error) {
    next(error);
  }
}

// Role gate only; ownership (e.g. seller owns this fulfilment) is still checked in the use-case.
export const authorize =
  (...roles) =>
  (req, _res, next) =>
    next(roles.includes(req.auth?.role) ? undefined : new ForbiddenError());
