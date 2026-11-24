import { ForbiddenError, NotFoundError } from '../errors/AppError.js';
import { Order } from '../../modules/order/public/index.js';
import { User } from '../../modules/identity/infrastructure/persistence/user.model.js';
import { isUnrestricted, withinLimit } from '../rbac/scopes.js';

// What an admin's role scope narrows (see rbac/scopes.js): which sellers or categories they may touch, and how much money they
// may move without a second approver. Read fresh per request like permissions are, and an unrestricted scope means everything.

export async function adminScope(req) {
  req.adminScope ??= (await User.findById(req.auth.userId, 'scope').lean())?.scope ?? {};
  return req.adminScope;
}

/** The ids this admin is limited to for `dimension` ('sellers' | 'categories'), or null when unrestricted. */
export async function scopedIds(req, dimension) {
  const scope = await adminScope(req);
  return isUnrestricted(scope, dimension) ? null : scope[dimension].map(String);
}

/** Out-of-scope records answer 404, as if they did not exist, so scope never leaks what is outside it. */
export async function assertInScope(req, dimension, id, message = 'That record does not exist.') {
  const ids = await scopedIds(req, dimension);
  if (ids && !ids.includes(String(id))) throw new NotFoundError(message);
}

/** True when `amountPaise` is over this admin's own limit (`refundLimit` | `walletAdjustLimit`) and so needs a second approver. */
export async function overLimit(req, limitKey, amountPaise) {
  return !withinLimit(await adminScope(req), limitKey, amountPaise);
}

/** The customers who bought from this admin's sellers (so customer screens show only them), or null when unrestricted. */
export async function scopedCustomerIds(req) {
  const sellers = await scopedIds(req, 'sellers');
  return sellers ? (await Order.distinct('customerId', { 'subOrders.sellerId': { $in: sellers } })).map(String) : null;
}

/** Platform-wide numbers cannot be cut down to some sellers, so an admin limited to sellers is not shown them. */
export async function assertPlatformWide(req) {
  if (await scopedIds(req, 'sellers')) throw new ForbiddenError('These numbers cover every seller, and your role is limited to some sellers.');
}
