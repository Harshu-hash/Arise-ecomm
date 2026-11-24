/**
 * Data scoping (plan §12.3). A role assignment can narrow what a user sees
 * along these dimensions, and can cap the money they may move without an
 * approval. `null`/absent means unrestricted.
 */

export const SCOPE_DIMENSIONS = [
  {
    key: 'categories',
    label: 'Categories',
    help: 'Limits catalog, QC and listing screens to these categories.',
    entity: 'category',
  },
  {
    key: 'sellers',
    label: 'Sellers',
    help: 'Limits seller, listing, order and payout screens to these sellers.',
    entity: 'seller',
  },
];

export const SCOPE_LIMITS = [
  {
    key: 'refundLimit',
    label: 'Refund retry without approval',
    help: 'Retrying a failed refund above this amount waits for a second admin to approve it.',
    defaultPaise: 500000,
  },
  {
    key: 'walletAdjustLimit',
    label: 'Wallet credit without approval',
    help: 'Manual wallet credit or debit above this amount needs approval.',
    defaultPaise: 100000,
  },
];

export const UNRESTRICTED = Object.freeze({
  categories: null,
  sellers: null,
  refundLimit: null,
  walletAdjustLimit: null,
});

/** True when the scope places no restriction on `dimension`. */
export function isUnrestricted(scope, dimension) {
  const v = scope?.[dimension];
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

/** True when `id` is inside the user's scope for `dimension`. */
export function inScope(scope, dimension, id) {
  if (isUnrestricted(scope, dimension)) return true;
  return scope[dimension].includes(id);
}

/**
 * Money limits: `null` means no cap. Returns true when the amount is within
 * what the user may do unilaterally.
 */
export function withinLimit(scope, limitKey, amountPaise) {
  const limit = scope?.[limitKey];
  if (limit === null || limit === undefined) return true;
  return amountPaise <= limit;
}

export function describeScope(scope) {
  if (!scope) return 'Unrestricted';
  const parts = [];
  for (const d of SCOPE_DIMENSIONS) {
    if (!isUnrestricted(scope, d.key)) parts.push(`${scope[d.key].length} ${d.label.toLowerCase()}`);
  }
  for (const l of SCOPE_LIMITS) {
    if (scope[l.key] !== null && scope[l.key] !== undefined) {
      parts.push(`${l.label.toLowerCase()} capped`);
    }
  }
  return parts.length ? parts.join(' · ') : 'Unrestricted';
}
