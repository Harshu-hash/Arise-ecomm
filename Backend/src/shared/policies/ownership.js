import { ForbiddenError, NotFoundError } from '../errors/AppError.js';

// Seller queries MUST take sellerId from the authenticated principal, never from the request body/params.
export function sellerScope(req) {
  if (!req.auth?.sellerId) throw new ForbiddenError('A seller account is required.');
  return req.auth.sellerId;
}

export const requireSellerScope = (req, _res, next) => {
  try {
    sellerScope(req);
    next();
  } catch (error) {
    next(error);
  }
};

// 404 (not 403) on mismatch so resource ids cannot be probed across owners.
export function assertOwner(resourceOwnerId, actorId) {
  if (!resourceOwnerId || String(resourceOwnerId) !== String(actorId)) throw new NotFoundError();
}

// Maker-checker: the person who requested a high-risk action can never approve it.
export function assertMakerChecker(makerId, checkerId) {
  if (String(makerId) === String(checkerId)) {
    throw new ForbiddenError('A request cannot be approved by the person who made it.');
  }
}
