/**
 * Ported from the admin console's src/shared/core/rbac/scopes.js: the data-scoping
 * dimensions a role assignment can narrow (plan §12.3). Every dimension here is enforced by the backend
 * (shared/middleware/scope.js): sellers (sellers, finance, orders, returns), categories (catalog) and the two
 * money limits (a wallet adjustment or refund retry over the limit waits for a second admin: module approval).
 * Warehouses and support queues were removed: nothing in the backend has either. Display-only helpers
 * (describeScope) are not needed server-side and were left out.
 */

export const SCOPE_DIMENSIONS = [
  { key: 'categories', label: 'Categories', entity: 'category' },
  { key: 'sellers', label: 'Sellers', entity: 'seller' },
];

export const SCOPE_LIMITS = [
  { key: 'refundLimit', label: 'Refund retry without approval', defaultPaise: 500000 },
  { key: 'walletAdjustLimit', label: 'Wallet credit without approval', defaultPaise: 100000 },
];

export const UNRESTRICTED = Object.freeze({
  categories: null,
  sellers: null,
  refundLimit: null,
  walletAdjustLimit: null,
});

export function isUnrestricted(scope, dimension) {
  const v = scope?.[dimension];
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

export function inScope(scope, dimension, id) {
  if (isUnrestricted(scope, dimension)) return true;
  return scope[dimension].includes(id);
}

export function withinLimit(scope, limitKey, amountPaise) {
  const limit = scope?.[limitKey];
  if (limit === null || limit === undefined) return true;
  return amountPaise <= limit;
}
