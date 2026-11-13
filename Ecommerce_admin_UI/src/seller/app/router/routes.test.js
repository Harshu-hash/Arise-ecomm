import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_NAV_ITEMS } from '@seller/nav/navigation';
import { router } from './index';

describe('seller router', () => {
  it('builds and is mounted under the /seller basename', () => {
    expect(router).toBeTruthy();
    expect(router.routes.length).toBeGreaterThan(0);
    expect(router.basename).toBe('/seller');
  });

  it('nav paths are unique', () => {
    const paths = ALL_NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('every nav item is a real screen', () => {
  // jsdom gives import.meta.url an http origin, so resolve from the cwd.
  const source = readFileSync(path.resolve('src/seller/app/router/index.jsx'), 'utf8');
  const isImplemented = (item) => source.includes(`path: '${item.path}'`);

  for (const item of ALL_NAV_ITEMS) {
    it(`"${item.label}" (${item.path}) resolves to a built screen`, () => {
      expect(isImplemented(item)).toBe(true);
    });
  }
});
