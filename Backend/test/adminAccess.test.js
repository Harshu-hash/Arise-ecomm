// DB-free checks for the admin roles / users / settings surface: pure rules plus the auth gate.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-up-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

test('role rules: key slug, permission union and catalog validation', async () => {
  const { normalizePermissions, permissionsFromRoles, roleKeyOf } = await import('../src/modules/identity/domain/services/accessRules.js');
  assert.equal(roleKeyOf('  Regional Support Lead! '), 'regional_support_lead');
  assert.equal(roleKeyOf('***'), '');
  assert.deepEqual(permissionsFromRoles([{ permissions: ['a.b.view'] }, { permissions: ['a.b.view', 'c.d.view'] }]), ['a.b.view', 'c.d.view']);
  assert.deepEqual(permissionsFromRoles([{ permissions: ['a.b.view'] }, { permissions: ['*'] }]), ['*']);
  // `edit` pulls in the `view` it depends on.
  assert.ok(normalizePermissions(['catalog.category.edit']).includes('catalog.category.view'));
  assert.throws(() => normalizePermissions(['nope.nope.nope']), { code: 'VALIDATION_ERROR' });
  assert.ok(normalizePermissions(['*']).length > 300 && !normalizePermissions(['*']).includes('*'));
});

test('a limited role needs its limits filled in', async () => {
  const { missingScopeFields } = await import('../src/modules/identity/domain/services/accessRules.js');
  const account = { scopedBy: ['sellers'] };
  const finance = { scopedBy: ['refundLimit', 'walletAdjustLimit'] };
  assert.deepEqual(Object.keys(missingScopeFields([account], null)), ['scope.sellers']);
  assert.deepEqual(Object.keys(missingScopeFields([account], { sellers: [] })), ['scope.sellers'], 'an empty list means no limit');
  assert.deepEqual(missingScopeFields([account], { sellers: ['s1'] }), {});
  assert.deepEqual(Object.keys(missingScopeFields([finance], { refundLimit: 500000 })), ['scope.walletAdjustLimit']);
  assert.deepEqual(missingScopeFields([finance], { refundLimit: 0, walletAdjustLimit: 100000 }), {}, 'zero is a real limit: everything needs approval');
  assert.deepEqual(Object.keys(missingScopeFields([account, finance], { sellers: ['s1'] })).sort(), ['scope.refundLimit', 'scope.walletAdjustLimit']);
  assert.deepEqual(missingScopeFields([{ scopedBy: [] }, {}], null), {}, 'an unlimited role asks for nothing');
});

test('settings schemas accept every default and reject bad or unknown values', async () => {
  const { SETTINGS_SECTIONS } = await import('../src/modules/admin/domain/constants/platformSettings.js');
  const { SECTION_SCHEMAS } = await import('../src/modules/admin/domain/services/settingsRules.js');
  for (const section of SETTINGS_SECTIONS) {
    assert.ok(SECTION_SCHEMAS[section.id].safeParse(section.values).success, `${section.id} defaults must be valid`);
  }
  const orders = SETTINGS_SECTIONS.find((s) => s.id === 'orders').values;
  assert.equal(SECTION_SCHEMAS.orders.safeParse({ ...orders, codMinPaise: 900_000 }).success, false); // min > max
  assert.equal(SECTION_SCHEMAS.orders.safeParse({ ...orders, maxQtyPerOrder: 0 }).success, false);
  assert.equal(SECTION_SCHEMAS.orders.safeParse({ ...orders, surprise: 1 }).success, false);
  const payments = SETTINGS_SECTIONS.find((s) => s.id === 'payments').values;
  assert.equal(SECTION_SCHEMAS.payments.safeParse({ ...payments, walletUsageCapPct: 101 }).success, false);
  assert.equal(SECTION_SCHEMAS.payments.safeParse({ ...payments, enabledMethods: [] }).success, false);
  const security = SETTINGS_SECTIONS.find((s) => s.id === 'security').values;
  assert.equal(SECTION_SCHEMAS.security.safeParse({ ...security, ipAllowlist: ['10.0.0.0/8', '::1'] }).success, true);
  assert.equal(SECTION_SCHEMAS.security.safeParse({ ...security, ipAllowlist: ['not-an-ip'] }).success, false);
});

test('banner status follows the schedule; campaign moves and windows are rule-checked', async () => {
  const { bannerStatus, statusFilter } = await import('../src/modules/admin/domain/services/bannerRules.js');
  const now = new Date('2026-06-15T00:00:00Z');
  const at = (day) => new Date(`2026-06-${day}T00:00:00Z`);
  assert.equal(bannerStatus({ startsAt: at(20), endsAt: at(25) }, now), 'SCHEDULED');
  assert.equal(bannerStatus({ startsAt: at(10), endsAt: at(14) }, now), 'EXPIRED');
  assert.equal(bannerStatus({ startsAt: at(10), endsAt: at(20) }, now), 'LIVE');
  assert.deepEqual(statusFilter(['EXPIRED', 'bogus'], now), { $or: [{ endsAt: { $lt: now } }] });

  const { canTransition, windowErrors } = await import('../src/modules/coupon/domain/services/campaignRules.js');
  assert.ok(canTransition('DRAFT', 'OPEN') && canTransition('ACTIVE', 'PAUSED') && canTransition('PAUSED', 'ACTIVE'));
  assert.ok(!canTransition('DRAFT', 'ACTIVE') && !canTransition('ENDED', 'ACTIVE') && !canTransition('CANCELLED', 'OPEN'));
  assert.equal(windowErrors({ startsAt: at(10), endsAt: at(12), submissionDeadline: at(11) }), null);
  assert.ok(windowErrors({ startsAt: at(12), endsAt: at(10) }).endsAt);
  assert.ok(windowErrors({ startsAt: at(10), endsAt: at(12), submissionDeadline: at(13) }).submissionDeadline);
});

test('admin API routes all require authentication', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/v1`;
  const id = 'a'.repeat(24);
  for (const [method, path] of [
    ['GET', '/roles'], ['GET', `/roles/${id}`], ['POST', '/roles'], ['POST', `/roles/${id}/clone`],
    ['PATCH', `/roles/${id}`], ['DELETE', `/roles/${id}`],
    ['GET', '/admin-users'], ['GET', `/admin-users/${id}`], ['POST', '/admin-users'], ['PATCH', `/admin-users/${id}`],
    ['POST', `/admin-users/${id}/deactivate`], ['POST', `/admin-users/${id}/reactivate`],
    ['POST', `/admin-users/${id}/resend-invite`], ['POST', `/admin-users/${id}/revoke-sessions`],
    ['GET', '/admin/settings'], ['PATCH', '/admin/settings/general'],
    ['GET', '/customers'], ['GET', `/customers/${id}`], ['POST', `/customers/${id}/block`], ['POST', `/customers/${id}/unblock`],
    ['GET', '/banners'], ['POST', '/banners'], ['PATCH', `/banners/${id}`], ['DELETE', `/banners/${id}`],
    ['GET', '/campaigns'], ['POST', '/campaigns'], ['GET', `/campaigns/${id}`], ['PATCH', `/campaigns/${id}`],
    ['POST', `/campaigns/${id}/status`], ['GET', `/campaigns/${id}/submissions`], ['POST', `/campaigns/${id}/submissions/decision`],
  ]) {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});
