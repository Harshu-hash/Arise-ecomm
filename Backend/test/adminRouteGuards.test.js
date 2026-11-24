// Deny by default for the admin API: every route mounted under /api/admin/v1 must sit behind a permission guard
// (requirePermission / requireAnyPermission, or a handler marked with markPermissionGuard). A developer who adds an admin
// route and forgets the guard fails this test instead of silently opening it to every admin.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-guards-')),
});

// Routes that are deliberately open to any signed-in admin, with the reason.
const OPEN_TO_ANY_ADMIN = new Set([
  // none yet: add 'METHOD /path' here only with a comment saying why no permission applies
]);

const routesFile = new URL('../src/app/routes.js', import.meta.url);
const source = readFileSync(routesFile, 'utf8');

// import { a, b } from '../modules/x.js'  ->  name -> absolute file URL
const importOf = new Map();
for (const [, names, from] of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
  for (const name of names.split(',').map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)) importOf.set(name, new URL(from, routesFile).href);
}
const adminFactories = [...new Set([...source.matchAll(/root\.use\(\s*(?:\[[^\]]*\]|'\/api\/admin\/v1[^']*'|`\/api\/admin\/v1[^`]*`)\s*,\s*(create\w+)\(/g)].map((match) => match[1]))]
  .filter((name) => importOf.has(name));

function unguardedRoutes(router, guarded = false, found = []) {
  let guard = guarded;
  for (const layer of router.stack) {
    if (layer.route) {
      const own = layer.route.stack.some((entry) => entry.handle.isPermissionGuard);
      if (!guard && !own) for (const method of Object.keys(layer.route.methods)) found.push(`${method.toUpperCase()} ${layer.route.path}`);
    } else if (layer.handle?.stack) {
      unguardedRoutes(layer.handle, guard, found);
    } else if (layer.handle?.isPermissionGuard) {
      guard = true; // router.use(guard): everything registered after it is covered
    }
  }
  return found;
}

test('the admin router list is found (guards the guard test itself)', () => {
  assert.ok(adminFactories.length >= 25, `only found ${adminFactories.length} admin routers`);
});

test('every admin route is behind a permission guard', async () => {
  const open = [];
  for (const name of adminFactories) {
    const module = await import(importOf.get(name));
    for (const route of unguardedRoutes(module[name]())) {
      const label = `${name}: ${route}`;
      if (!OPEN_TO_ANY_ADMIN.has(label)) open.push(label);
    }
  }
  assert.deepEqual(open, [], 'admin routes with no permission guard');
});
