import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, PERMISSION_KEYS } from '@core/rbac/catalog';
import { buildRoleSections, canSeeNavItem, firstAllowedPath, navItemForLocation, requiredKeysFor } from './access';
import { ALL_NAV_ITEMS } from './navigation';

const resourceIds = new Set(ALL_PERMISSIONS.map((p) => `${p.moduleKey}.${p.resourceKey}`));

describe('sidebar <-> role-based access', () => {
  it('every sidebar item declares real catalog resources (this is what a new item must do)', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(item.resources?.length, `${item.label} needs \`resources\` in nav/navigation.js`).toBeGreaterThan(0);
      for (const resource of item.resources) expect(resourceIds.has(resource), `${item.label}: unknown resource ${resource}`).toBe(true);
    }
  });

  it('every sidebar item is listed in the Roles editor, and every catalog resource is grantable somewhere', () => {
    const sections = buildRoleSections();
    const listed = new Set(sections.flatMap((section) => section.res));
    for (const item of ALL_NAV_ITEMS) item.resources.forEach((resource) => expect(listed.has(resource)).toBe(true));
    expect([...resourceIds].filter((resource) => !listed.has(resource))).toEqual([]);
  });

  it('shows an item only to admins holding a permission on its resources', () => {
    const chat = ALL_NAV_ITEMS.find((item) => item.path === '/support/chat');
    const orders = ALL_NAV_ITEMS.find((item) => item.path === '/orders');
    const agent = new Set(['support.chat.handle']);
    expect(canSeeNavItem(chat, agent)).toBe(true);
    expect(canSeeNavItem(orders, agent)).toBe(false);
    expect(canSeeNavItem(orders, new Set())).toBe(false);
    expect(ALL_NAV_ITEMS.every((item) => canSeeNavItem(item, new Set(['*'])))).toBe(true);
    expect(requiredKeysFor(chat)).toEqual(['support.chat.handle']);
  });

  it('sends an admin without dashboard access to the first page they can open', () => {
    expect(firstAllowedPath(new Set(['support.chat.handle']))).toBe('/support/chat');
    expect(firstAllowedPath(new Set(['dashboard.dashboard.view']))).toBe('/');
    expect(firstAllowedPath(new Set())).toBeNull();
  });

  it('maps a URL to the longest matching sidebar item, and leaves unrelated URLs alone', () => {
    expect(navItemForLocation('/').path).toBe('/');
    expect(navItemForLocation('/orders/123').path).toBe('/orders');
    expect(navItemForLocation('/sellers/applications/9').path).toBe('/sellers/applications');
    expect(navItemForLocation('/sellers/42').path).toBe('/sellers');
    expect(navItemForLocation('/profile')).toBeNull();
  });
});

// The console keeps its own copy of the permission catalog; the backend enforces the real one. They must not drift.
describe('permission catalog matches the backend', () => {
  const backend = path.resolve('../Backend/src/shared/rbac/permissionCatalog.js');
  it.skipIf(!existsSync(backend))('has exactly the same keys', () => {
    // the backend file is plain data with no imports, so evaluate its text rather than import across packages
    const PERMISSION_MODULES = new Function(readFileSync(backend, 'utf8').replaceAll('export ', '') + '; return PERMISSION_MODULES;')();
    const server = PERMISSION_MODULES.flatMap((m) => m.resources.flatMap((r) => r.actions.map((a) => `${m.key}.${r.key}.${a.action}`)));
    expect([...server].sort()).toEqual([...PERMISSION_KEYS].sort());
  });
});
