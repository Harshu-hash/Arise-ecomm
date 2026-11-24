import { ALL_PERMISSIONS } from '@core/rbac/catalog';
import { ALL_NAV_ITEMS, NAV_GROUPS } from './navigation';

/**
 * The bridge between the sidebar and role-based access. Everything here is derived from NAV_GROUPS, so adding a
 * sidebar item (with its `resources`) is the only step needed for it to be hidden from admins without access,
 * guarded as a route, and listed in the Roles editor.
 */

const resourceOf = (permission) => `${permission.moduleKey}.${permission.resourceKey}`;

/** True when the admin holds any permission on one of the item's resources. '*' (Super Admin) holds everything. */
export function canSeeNavItem(item, permissions) {
  if (!item.resources?.length || permissions.has('*')) return true;
  const held = [...permissions];
  return item.resources.some((resource) => held.some((key) => key.startsWith(`${resource}.`)));
}

/** Where to send an admin who opens a page they may not use at the front door ('/'): the first sidebar page they can open. */
export function firstAllowedPath(permissions) {
  return ALL_NAV_ITEMS.find((item) => canSeeNavItem(item, permissions))?.path ?? null;
}

/** The sidebar item that owns this URL: the longest item path that is the URL or a parent of it ('/' only matches itself). */
export function navItemForLocation(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ALL_NAV_ITEMS
    .filter((item) => clean === item.path || (item.path !== '/' && clean.startsWith(`${item.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

/** One example key per resource, for the "you need ..." line on the 403 page. */
export function requiredKeysFor(item) {
  return (item.resources ?? []).map((resource) => ALL_PERMISSIONS.find((p) => resourceOf(p) === resource)?.key).filter(Boolean);
}

/**
 * Sections of the Roles editor: one per sidebar group, holding the resources of its items. Catalog resources no sidebar
 * item claims (the backend enforces some of them, e.g. audit log) go in a last section, so every permission stays grantable.
 */
export function buildRoleSections() {
  const claimed = new Set();
  const sections = NAV_GROUPS.map((group) => {
    const res = [...new Set(group.items.flatMap((item) => item.resources ?? []))];
    res.forEach((resource) => claimed.add(resource));
    return { key: group.key, label: group.label ?? group.items[0].label, res };
  }).filter((section) => section.res.length);
  const other = [...new Set(ALL_PERMISSIONS.map(resourceOf))].filter((resource) => !claimed.has(resource));
  return other.length ? [...sections, { key: 'other', label: 'Other permissions (no menu page)', res: other }] : sections;
}
