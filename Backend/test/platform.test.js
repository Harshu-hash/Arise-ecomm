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
  METRICS_TOKEN: 'm'.repeat(40),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-up-')), // must be set before the app modules load
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

test('TOTP matches the RFC 6238 vector and rejects wrong/stale codes', async () => {
  const { totpCodeAt, verifyTotp } = await import('../src/shared/utils/totp.js');
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // ASCII "12345678901234567890"
  assert.equal(totpCodeAt(secret, 59_000), '287082'); // RFC 6238 appendix B (last 6 digits of 94287082)
  assert.equal(verifyTotp(secret, '287082', { now: 59_000 }), 1);
  assert.equal(verifyTotp(secret, '000000', { now: 59_000 }), null);
  assert.equal(verifyTotp(secret, '287082', { now: 59_000 + 5 * 30_000 }), null);
});

test('audit redaction masks sensitive keys at any depth', async () => {
  const { redact } = await import('../src/infrastructure/audit/audit.js');
  const out = redact({ name: 'x', password: 'p', bank: { accountNumber: '123', ifsc: 'A', city: 'Pune' }, list: [{ token: 't' }] });
  assert.deepEqual(out, { name: 'x', password: '[REDACTED]', bank: { accountNumber: '[REDACTED]', ifsc: '[REDACTED]', city: 'Pune' }, list: [{ token: '[REDACTED]' }] });
});

test('ownership and maker-checker policies', async () => {
  const { assertMakerChecker, assertOwner, sellerScope } = await import('../src/shared/policies/ownership.js');
  assert.throws(() => assertOwner('u2', 'u1'), { code: 'NOT_FOUND' });
  assert.doesNotThrow(() => assertOwner('u1', 'u1'));
  assert.throws(() => assertMakerChecker('a', 'a'), { code: 'FORBIDDEN' });
  assert.throws(() => sellerScope({ auth: { userId: 'u' } }), { code: 'FORBIDDEN' });
  assert.equal(sellerScope({ auth: { sellerId: 's1' } }), 's1');
});

test('ip allowlist permits listed IPs/CIDRs and blocks others', async () => {
  const { ipAllowlist } = await import('../src/shared/middleware/ipAllowlist.js');
  const run = (mw, ip) => new Promise((resolve) => mw({ ip }, {}, resolve));
  const mw = ipAllowlist(['203.0.113.7', '10.0.0.0/8']);
  assert.equal(await run(mw, '203.0.113.7'), undefined);
  assert.equal(await run(mw, '::ffff:10.2.3.4'), undefined);
  assert.equal((await run(mw, '198.51.100.1')).code, 'FORBIDDEN');
  assert.equal(await run(ipAllowlist([]), '198.51.100.1'), undefined);
});

test('/metrics requires the bearer token and exposes http + queue metrics', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${base}/metrics`)).status, 401);
  await fetch(`${base}/health/live`);
  const ok = await fetch(`${base}/metrics`, { headers: { authorization: `Bearer ${'m'.repeat(40)}` } });
  assert.equal(ok.status, 200);
  const text = await ok.text();
  assert.match(text, /http_request_duration_seconds_count\{[^}]*route="\/health\/live"/);
});

test('common validators', async () => {
  const { objectIdSchema, paginationQuery, phoneINSchema } = await import('../src/shared/validators/common.js');
  assert.equal(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success, true);
  assert.equal(objectIdSchema.safeParse('{"$ne":1}').success, false);
  assert.equal(phoneINSchema.safeParse('9876543210').success, true);
  assert.equal(paginationQuery.parse({ limit: '5' }).limit, 5);
  assert.equal(paginationQuery.safeParse({ limit: '5000' }).success, false);
});

test('uploads: type sniffing, ownership, privacy and traversal', async (t) => {
  const { readdir } = await import('node:fs/promises');

  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { resolveKey } = await import('../src/infrastructure/storage/local.storage.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);
  const auth = (claims) => ({ authorization: `Bearer ${signAccessToken(claims)}` });
  const seller = auth({ sub: 'u1', role: 'SELLER', sellerId: 's1' });
  const otherSeller = auth({ sub: 'u2', role: 'SELLER', sellerId: 's2' });
  const customer = auth({ sub: 'c1', role: 'CUSTOMER' });
  const admin = auth({ sub: 'a1', role: 'ADMIN' });
  const upload = (headers, purpose, bytes, name = 'x.png') => {
    const form = new FormData();
    form.set('purpose', purpose);
    form.set('file', new Blob([bytes]), name);
    return fetch(`${base}/api/seller/v1/uploads`, { method: 'POST', headers, body: form });
  };

  // Public product image: stored under the token's sellerId, served at /uploads, name is a UUID not the client's.
  const ok = await upload(seller, 'PRODUCT_MEDIA', png, '../../evil name.png');
  assert.equal(ok.status, 201);
  const { data } = await ok.json();
  assert.match(data.key, /^public\/products\/s1\/[0-9a-f-]{36}\.png$/);
  const served = await fetch(data.url.replace('http://localhost:4000', base));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('cross-origin-resource-policy'), 'cross-origin');

  // A file that is not really an image is rejected whatever its name/Content-Type claims.
  assert.equal((await upload(seller, 'PRODUCT_MEDIA', Buffer.from('MZ\x90\x00 fake exe'), 'shell.png')).status, 422);
  // Wrong role for the purpose.
  assert.equal((await upload(customer, 'PRODUCT_MEDIA', png)).status, 403);
  // No file / no auth.
  assert.equal((await fetch(`${base}/api/seller/v1/uploads`, { method: 'POST' })).status, 401);
  assert.deepEqual(await readdir(join(process.env.UPLOAD_DIR, 'tmp')), []); // rejected uploads leave no temp files

  // Private KYC document: owner and admin can read; another seller cannot; never reachable via /uploads.
  const kyc = await (await upload(seller, 'SELLER_KYC', pdf, 'gst.pdf')).json();
  const [, folder, ownerId, file] = kyc.data.key.split('/');
  assert.equal(kyc.data.url, undefined);
  const get = (headers) => fetch(`${base}/api/seller/v1/uploads/private/${folder}/${ownerId}/${file}`, { headers });
  assert.equal((await get(seller)).status, 200);
  assert.equal((await get(admin)).status, 200);
  assert.equal((await get(otherSeller)).status, 404);
  assert.equal((await fetch(`${base}/uploads/../private/${folder}/${ownerId}/${file}`)).status, 404);

  assert.throws(() => resolveKey('../../etc/passwd'), { code: 'NOT_FOUND' });
});
