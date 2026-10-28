import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_NAV_ITEMS, CURRENT_PHASE } from '@seller/nav/navigation';
import { SELLER_PERMISSION_KEYS, SELLER_ROLE_TEMPLATES, permissionsForRole } from '@seller/rbac/permissions';
import { router } from './index';

describe('seller navigation & rbac are consistent', () => {
  it('every nav item is gated by a real seller permission key', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(SELLER_PERMISSION_KEYS, `nav "${item.label}" → ${item.perm}`).toContain(item.perm);
    }
  });

  it('nav paths are unique', () => {
    const paths = ALL_NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('owner and admin roles hold the wildcard, so they can open everything', () => {
    expect(permissionsForRole('owner')).toEqual(['*']);
    expect(permissionsForRole('admin')).toEqual(['*']);
  });

  it('every non-wildcard role template references only real permission keys', () => {
    for (const role of SELLER_ROLE_TEMPLATES) {
      if (role.permissions.includes('*')) continue;
      for (const key of role.permissions) {
        expect(SELLER_PERMISSION_KEYS, `role "${role.key}" → ${key}`).toContain(key);
      }
    }
  });
});

describe('seller router', () => {
  it('builds and is mounted under the /seller basename', () => {
    expect(router).toBeTruthy();
    expect(router.routes.length).toBeGreaterThan(0);
    expect(router.basename).toBe('/seller');
  });

  it('CURRENT_PHASE is a positive integer', () => {
    expect(Number.isInteger(CURRENT_PHASE)).toBe(true);
    expect(CURRENT_PHASE).toBeGreaterThan(0);
  });
});

describe('every nav item is a real screen (Phase S8: no placeholders left)', () => {
  // jsdom gives import.meta.url an http origin, so resolve from the cwd, the
  // same approach the admin router's own routes.test.js uses.
  const source = readFileSync(path.resolve('src/seller/app/router/index.jsx'), 'utf8');
  const isImplemented = (item) => source.includes(`path: '${item.path}'`);

  for (const item of ALL_NAV_ITEMS) {
    it(`"${item.label}" (${item.path}) resolves to a built screen`, () => {
      expect(isImplemented(item)).toBe(true);
    });
  }
});
