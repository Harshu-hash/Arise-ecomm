import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  RATE_LIMIT_MAX: '5',
  AUTH_RATE_LIMIT_MAX: '2',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  RAZORPAY_WEBHOOK_SECRET: 'whsec_test',
});

async function listen(t) {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('global rate limit is per IP and returns the error envelope', async (t) => {
  const base = await listen(t);
  const statuses = [];
  for (let i = 0; i < 6; i += 1) statuses.push((await fetch(`${base}/health/live`)).status);
  assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200]);
  assert.equal(statuses[5], 429);
});

test('auth routes get the stricter bucket', async (t) => {
  const base = await listen(t);
  const first = await fetch(`${base}/api/customer/v1/auth/login`, { method: 'POST' });
  await fetch(`${base}/api/customer/v1/auth/login`, { method: 'POST' });
  const third = await fetch(`${base}/api/customer/v1/auth/login`, { method: 'POST' });
  assert.equal(first.status, 404);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error.code, 'RATE_LIMITED');
});

test('razorpay webhook rejects bad signatures and missing event ids before touching the database', async (t) => {
  const base = await listen(t);
  const body = JSON.stringify({ event: 'payment.captured' });
  const url = `${base}/webhooks/v1/payments/razorpay`;
  const headers = { 'content-type': 'application/json' };

  const forged = await fetch(url, { method: 'POST', headers: { ...headers, 'x-razorpay-signature': 'nope' }, body });
  assert.equal(forged.status, 401);

  const signature = createHmac('sha256', 'whsec_test').update(body).digest('hex');
  const noEventId = await fetch(url, { method: 'POST', headers: { ...headers, 'x-razorpay-signature': signature }, body });
  assert.equal(noEventId.status, 422);
});

test('jwt round-trips and refuses a refresh token as an access token', async () => {
  const { signAccessToken, signRefreshToken, verifyAccessToken } = await import('../src/shared/utils/jwt.js');
  const claims = verifyAccessToken(signAccessToken({ sub: 'u1', role: 'CUSTOMER' }));
  assert.equal(claims.sub, 'u1');
  assert.throws(() => verifyAccessToken(signRefreshToken({ sub: 'u1', sid: 's1', jti: 'j1' })), { code: 'UNAUTHORIZED' });
});

test('passwords hash/verify and sensitive fields encrypt/decrypt', async () => {
  const { decryptField, encryptField, hashPassword, verifyPassword } = await import('../src/shared/utils/crypto.js');
  const stored = await hashPassword('Correct#Horse1');
  assert.equal(await verifyPassword('Correct#Horse1', stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  const cipher = encryptField('1234567890');
  assert.notEqual(cipher, '1234567890');
  assert.equal(decryptField(cipher), '1234567890');
});

test('mongo operator keys are stripped from input', async (t) => {
  const { sanitizeInput } = await import('../src/shared/middleware/sanitize.js');
  const req = { body: { email: { $ne: null }, ok: 1 }, params: {}, query: { 'a.b': 1, q: 'x' } };
  sanitizeInput(req, {}, () => undefined);
  assert.deepEqual(req.body, { email: {}, ok: 1 });
  assert.deepEqual(req.query, { q: 'x' });
});
