import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_NAV_ITEMS } from '@admin/nav/navigation';

/**
 * Every nav item must lead to a real route — the simplified panel has no
 * placeholder generator, so a sidebar link with no matching route is a bug.
 */
describe('routing covers the nav model', () => {
  // jsdom gives import.meta.url an http origin, so resolve from the cwd.
  const source = readFileSync(path.resolve('src/admin/app/router/index.jsx'), 'utf8');
  const isImplemented = (item) => source.includes(`path: '${item.path}'`);

  it('has a real route for every sidebar item', () => {
    const missing = ALL_NAV_ITEMS.filter((item) => !isImplemented(item)).map(
      (item) => `${item.label} → ${item.path}`,
    );

    expect(missing).toEqual([]);
  });
});
