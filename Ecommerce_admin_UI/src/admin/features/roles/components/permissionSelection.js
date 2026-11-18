import { dependentsOf, expandImplied, getPermission } from '@core/rbac/catalog';

/**
 * Adds or removes `keys` from the current selection. Adding pulls in everything
 * the keys imply (an action's own `view`); removing also strips the keys that
 * depend on what was removed, so the result is never an orphaned grant.
 */
export function toggleKeys(current, keys, on) {
  const next = new Set(current);
  if (on) {
    for (const k of expandImplied(keys)) next.add(k);
  } else {
    for (const k of keys) {
      next.delete(k);
      for (const dep of dependentsOf(k)) next.delete(dep);
    }
  }
  return Array.from(next);
}

/** Count of sensitive permissions in a selection — drives the editor's warning. */
export function sensitiveCount(keys) {
  return (keys ?? []).filter((k) => getPermission(k)?.sensitive).length;
}
