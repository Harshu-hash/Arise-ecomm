// Real-MongoDB tests. Opt-in: set TEST_MONGODB_URI (a throwaway database; it is dropped afterwards).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-up-')), // must be set before the app modules load
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };

before(async () => {
  if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
});
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('idempotency: replay, key reuse and failure release', opts, async (t) => {
  const { idempotent } = await import('../src/shared/middleware/idempotency.js');
  const { errorHandler } = await import('../src/shared/http/errorHandler.js');
  const { IdempotencyRecord } = await import('../src/infrastructure/idempotency/idempotency.model.js');
  await IdempotencyRecord.init();

  let executions = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => ((req.log = { warn() {}, error() {} }), next()));
  app.post('/pay', idempotent(), (req, res) => {
    executions += 1;
    if (req.body.fail) return res.status(500).json({ error: { code: 'X' } });
    return res.status(201).json({ data: { n: executions } });
  });
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (key, body) =>
    fetch(`http://127.0.0.1:${server.address().port}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key && { 'idempotency-key': key }) },
      body: JSON.stringify(body),
    });

  assert.equal((await post(null, {})).status, 422); // header required

  const first = await post('key-aaaaaaaa', { amount: 1 });
  const second = await post('key-aaaaaaaa', { amount: 1 });
  assert.equal(first.status, 201);
  assert.deepEqual(await second.json(), { data: { n: 1 } });
  assert.equal(second.headers.get('idempotent-replayed'), 'true');
  assert.equal(executions, 1);

  const reused = await post('key-aaaaaaaa', { amount: 2 });
  assert.equal(reused.status, 422);
  assert.equal((await reused.json()).error.code, 'IDEMPOTENCY_KEY_REUSED');

  assert.equal((await post('key-bbbbbbbb', { fail: true })).status, 500);
  assert.equal((await post('key-bbbbbbbb', { fail: true })).status, 500); // released, so it re-executed
  assert.equal(executions, 3);
});

test('sessions: rotation works and replaying a used refresh token kills the session', opts, async () => {
  const { createSession, rotateSession } = await import('../src/modules/identity/public/index.js');
  const { verifyAccessToken } = await import('../src/shared/utils/jwt.js');

  const first = await createSession({ userId: 'u1', role: 'SELLER', sellerId: 's1', device: { ip: '1.1.1.1' } });
  assert.equal(verifyAccessToken(first.accessToken).sellerId, 's1');

  const second = await rotateSession(first.refreshToken);
  assert.notEqual(second.refreshToken, first.refreshToken);

  await assert.rejects(() => rotateSession(first.refreshToken), { code: 'UNAUTHORIZED' }); // reuse detected
  await assert.rejects(() => rotateSession(second.refreshToken), { code: 'UNAUTHORIZED' }); // whole session revoked
});

test('sessions: concurrent refresh with the same token lets only one win', opts, async () => {
  const { createSession, rotateSession } = await import('../src/modules/identity/public/index.js');
  const { refreshToken } = await createSession({ userId: 'u2', role: 'CUSTOMER' });
  const results = await Promise.allSettled([rotateSession(refreshToken), rotateSession(refreshToken)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('customer auth: OTP signup, login, refresh, password reset and logout', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  await User.init();

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1/auth`;
  const post = (path, body, token) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  const start = async (purpose, extra = {}) => {
    const response = await post('/start', { identifier: 'customer@arise.test', purpose, ...extra });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };

  const signup = await start('SIGNUP', { name: 'Asha Rao' });
  assert.equal((await post('/verify-otp', { challengeId: signup.challengeId, otp: '0000' })).status, 422);
  const signedUp = await post('/verify-otp', { challengeId: signup.challengeId, otp: signup.devHint.code });
  assert.equal(signedUp.status, 200);
  const firstSession = (await signedUp.json()).data;
  assert.equal(firstSession.user.email, 'customer@arise.test');
  assert.equal(firstSession.user.role, 'CUSTOMER');
  assert.ok(firstSession.accessToken);
  assert.ok(firstSession.refreshToken);

  const session = await fetch(`${base}/session`, { headers: { authorization: `Bearer ${firstSession.accessToken}` } });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).data.user.name, 'Asha Rao');

  const refreshed = await post('/refresh', { refreshToken: firstSession.refreshToken });
  assert.equal(refreshed.status, 200);
  const secondSession = (await refreshed.json()).data;
  assert.notEqual(secondSession.refreshToken, firstSession.refreshToken);

  assert.equal((await post('/start', { identifier: 'customer@arise.test', purpose: 'SIGNUP', name: 'Duplicate' })).status, 409);
  const login = await start('LOGIN');
  const loggedIn = await post('/verify-otp', { challengeId: login.challengeId, otp: login.devHint.code });
  assert.equal(loggedIn.status, 200);

  const reset = await start('PASSWORD_RESET');
  const verifiedReset = await post('/password/verify-otp', { challengeId: reset.challengeId, otp: reset.devHint.code });
  assert.equal(verifiedReset.status, 200);
  const { resetToken } = (await verifiedReset.json()).data;
  assert.equal((await post('/password/reset', { resetToken, password: 'NewPassword1' })).status, 200);

  const afterReset = await start('LOGIN');
  const afterResetLogin = await post('/verify-otp', { challengeId: afterReset.challengeId, otp: afterReset.devHint.code });
  const activeSession = (await afterResetLogin.json()).data;
  assert.equal((await post('/logout', { refreshToken: activeSession.refreshToken })).status, 200);
  assert.equal((await post('/refresh', { refreshToken: activeSession.refreshToken })).status, 401);

  // A seller may shop with the same phone; uniqueness is per audience/role, not global.
  await User.create({ role: 'SELLER', phone: '9876543210', name: 'Seller Customer' });
  const phoneSignup = await post('/start', { identifier: '9876543210', purpose: 'SIGNUP', name: 'Phone Customer' });
  const phoneChallenge = (await phoneSignup.json()).data;
  const phoneSession = await post('/verify-otp', { challengeId: phoneChallenge.challengeId, otp: phoneChallenge.devHint.code });
  assert.equal(phoneSession.status, 200);
  assert.equal((await phoneSession.json()).data.user.phone, '9876543210');
  const duplicatePhone = await post('/start', { identifier: '9876543210', purpose: 'SIGNUP', name: 'Duplicate' });
  assert.equal(duplicatePhone.status, 409);
  assert.match((await duplicatePhone.json()).error.message, /mobile number/);
});

test('webhook processor: handled, unhandled, failing and replayed receipts', opts, async () => {
  const { registerWebhookHandler, processReceipt } = await import('../src/infrastructure/webhooks/webhookProcessor.js');
  const { RECEIPT_STATUS, WebhookReceipt } = await import('../src/infrastructure/webhooks/webhookReceipt.model.js');
  await WebhookReceipt.init();

  let calls = 0;
  registerWebhookHandler('TEST', 'ok.event', 'counter', async () => { calls += 1; });
  registerWebhookHandler('TEST', 'bad.event', 'boom', async () => { throw new Error('boom'); });
  const make = (providerEventId, eventType) => WebhookReceipt.create({ provider: 'TEST', providerEventId, eventType, payload: {} });

  const ok = await make('e1', 'ok.event');
  assert.equal(await processReceipt(ok._id), RECEIPT_STATUS.PROCESSED);
  assert.equal(await processReceipt(ok._id), RECEIPT_STATUS.PROCESSED); // replay is a no-op
  assert.equal(calls, 1);

  await assert.rejects(make('e1', 'ok.event'), { code: 11000 }); // duplicate provider event

  const unknown = await make('e2', 'other.event');
  assert.equal(await processReceipt(unknown._id), RECEIPT_STATUS.UNHANDLED);

  const bad = await make('e3', 'bad.event');
  await assert.rejects(processReceipt(bad._id), /boom/);
  const stored = await WebhookReceipt.findById(bad._id).lean();
  assert.equal(stored.status, RECEIPT_STATUS.FAILED);
  assert.equal(stored.attempts, 1);
});

test('registration: OTP verification, duplicate checks and KYC document upload', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  await User.init();

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const verifyTarget = async (kind, value) => {
    const sent = await post('/api/seller/v1/auth/register/send-otp', { kind, value });
    assert.equal(sent.status, 200);
    const { challengeId, devHint } = (await sent.json()).data;
    assert.ok(devHint?.code); // non-production dev hint, since no email/SMS provider is configured

    assert.equal((await post('/api/seller/v1/auth/register/verify-otp', { challengeId, code: '000000' })).status, 422);
    const verified = await post('/api/seller/v1/auth/register/verify-otp', { challengeId, code: devHint.code });
    assert.equal(verified.status, 200);
    return (await verified.json()).data.verificationToken;
  };

  const exists = await post('/api/seller/v1/auth/register/check-exists', { kind: 'email', value: 'new@shop.test' });
  assert.deepEqual((await exists.json()).data, { exists: false });

  const emailVerificationToken = await verifyTarget('email', 'new@shop.test');
  const phoneVerificationToken = await verifyTarget('phone', '9876512345');

  // Sending another OTP for an already-verified-but-not-yet-registered target is still allowed;
  // registering with a stale/mismatched token, however, must fail.
  const BUSINESS_FIELDS = {
    gstin: '27AAPFU0939F1ZV', pan: 'AAPFU0939F',
    bankAccountHolder: 'Asha Rao', bankAccountNumber: '123456789012', bankIfsc: 'HDFC0001234',
  };
  const badSubmit = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Asha Rao', shopName: 'New Shop', email: 'new@shop.test', phone: '9876512345', password: 'Arise@123456',
    locality: 'Vesu', pincode: '395007', city: 'Surat', state: 'Gujarat', address: '10 Ring Road',
    ...BUSINESS_FIELDS,
    emailVerificationToken: 'wrong-token', phoneVerificationToken,
  })) badSubmit.append(key, value);
  const png = new Blob([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])]);
  const pdf = new Blob([Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)])]);
  for (const field of ['tradeLicense', 'gstCertificate', 'idProof']) badSubmit.append(field, pdf, `${field}.pdf`);
  assert.equal((await fetch(`${base}/api/seller/v1/auth/register`, { method: 'POST', body: badSubmit })).status, 401);

  const submit = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Asha Rao', shopName: 'New Shop', email: 'new@shop.test', phone: '9876512345', password: 'Arise@123456',
    locality: 'Vesu', pincode: '395007', city: 'Surat', state: 'Gujarat', address: '10 Ring Road',
    ...BUSINESS_FIELDS,
    emailVerificationToken, phoneVerificationToken,
  })) submit.append(key, value);
  submit.append('tradeLicense', pdf, 'trade.pdf');
  submit.append('gstCertificate', pdf, 'gst.pdf');
  submit.append('idProof', png, 'id.png');
  const registered = await fetch(`${base}/api/seller/v1/auth/register`, { method: 'POST', body: submit });
  assert.equal(registered.status, 201);
  const { sellerId, userId, status } = (await registered.json()).data;
  assert.equal(status, 'UNDER_REVIEW');

  const seller = await Seller.findById(sellerId).lean();
  assert.equal(seller.status, 'UNDER_REVIEW');
  assert.match(seller.documents.idProofKey, /^private\/kyc\//);
  const user = await User.findById(userId).lean();
  assert.equal(user.status, 'UNDER_REVIEW');

  // Login is blocked until an admin approves the application, even with the right password.
  assert.equal((await post('/api/seller/v1/auth/login', { email: 'new@shop.test', password: 'Arise@123456' })).status, 403);

  // A spent verification token cannot be reused for a second registration attempt.
  const replay = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Asha Rao', shopName: 'Another Shop', email: 'new@shop.test', phone: '9876512346', password: 'Arise@123456',
    locality: 'Vesu', pincode: '395007', city: 'Surat', state: 'Gujarat', address: '10 Ring Road',
    ...BUSINESS_FIELDS,
    emailVerificationToken, phoneVerificationToken: await verifyTarget('phone', '9876512346'),
  })) replay.append(key, value);
  for (const field of ['tradeLicense', 'gstCertificate', 'idProof']) replay.append(field, pdf, `${field}.pdf`);
  assert.equal((await fetch(`${base}/api/seller/v1/auth/register`, { method: 'POST', body: replay })).status, 401);
});

test('password reset and invite acceptance', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { hashPassword } = await import('../src/shared/utils/crypto.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { issueInvite } = await import('../src/modules/identity/application/invite.service.js');
  await User.init();

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  // Forgot-password never reveals whether the account exists.
  const unknown = await post('/api/admin/v1/auth/forgot-password', { email: 'nobody@arise.test' });
  assert.equal(unknown.status, 200);
  assert.equal((await unknown.json()).data.devHint, undefined);

  const admin = await User.create({
    role: 'ADMIN', email: 'ops@arise.test', passwordHash: await hashPassword('Old@Password1'), status: 'ACTIVE',
  });
  const forgot = await post('/api/admin/v1/auth/forgot-password', { email: 'ops@arise.test' });
  const { resetUrl } = (await forgot.json()).data.devHint;
  const token = new URL(resetUrl).searchParams.get('token');

  assert.equal((await post('/api/admin/v1/auth/reset-password', { token: 'bad-token', password: 'New@Password1' })).status, 401);
  const reset = await post('/api/admin/v1/auth/reset-password', { token, password: 'New@Password1' });
  assert.equal(reset.status, 200);
  assert.equal((await post('/api/admin/v1/auth/reset-password', { token, password: 'New@Password1' })).status, 401); // one-time use

  assert.equal((await post('/api/admin/v1/auth/login', { email: 'ops@arise.test', password: 'Old@Password1' })).status, 401);
  const loggedIn = await post('/api/admin/v1/auth/login', { email: 'ops@arise.test', password: 'New@Password1' });
  assert.equal(loggedIn.status, 200);
  assert.equal((await loggedIn.json()).data.user.id, String(admin._id));

  // Invite: admin has no 2FA, so accepting goes straight to a session.
  const adminInvite = await issueInvite({ role: 'ADMIN', email: 'new-admin@arise.test', name: 'Priya' });
  assert.ok(adminInvite.devHint.token);

  const fetched = await fetch(`${base}/api/admin/v1/auth/invite/${adminInvite.devHint.token}`);
  assert.deepEqual((await fetched.json()).data, { email: 'new-admin@arise.test', name: 'Priya', role: 'ADMIN' });

  const accepted = await post('/api/admin/v1/auth/invite/accept', {
    token: adminInvite.devHint.token, name: 'Priya Shah', password: 'Welcome@123',
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).data.user.status, 'ACTIVE');
  assert.equal((await fetch(`${base}/api/admin/v1/auth/invite/${adminInvite.devHint.token}`)).status, 404); // spent

  // Invite: seller staff also goes straight to a session — no 2FA on any audience.
  const staffInvite = await issueInvite({ role: 'SELLER_STAFF', email: 'staff@nova.test', name: 'Dev', sellerId: 's1' });
  const staffAccept = await post('/api/seller/v1/auth/invite/accept', {
    token: staffInvite.devHint.token, name: 'Dev Patel', password: 'Welcome@123',
  });
  const staffAcceptBody = (await staffAccept.json()).data;
  assert.equal(staffAcceptBody.stage, undefined);
  assert.ok(staffAcceptBody.accessToken);
});

test('admin RBAC: role seeding, permission gating and inviting an admin', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { hashPassword } = await import('../src/shared/utils/crypto.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Role, seedRoles } = await import('../src/modules/identity/infrastructure/persistence/role.model.js');
  const { ROLE_TEMPLATES, buildRoleFromTemplate } = await import('../src/shared/rbac/roleTemplates.js');
  await User.init();
  await seedRoles();
  await Role.create(buildRoleFromTemplate(ROLE_TEMPLATES.find((r) => r.key === 'operations_manager')));

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const superAdmin = await User.create({
    role: 'ADMIN', email: 'super@arise.test', passwordHash: await hashPassword('x'), status: 'ACTIVE', permissions: ['*'],
  });
  const opsManager = await User.create({
    role: 'ADMIN', email: 'ops@arise.test', passwordHash: await hashPassword('x'), status: 'ACTIVE',
    permissions: (await Role.findOne({ key: 'operations_manager' }).lean()).permissions,
  });
  const authHeader = (user) => ({ authorization: `Bearer ${signAccessToken({ sub: String(user._id), role: 'ADMIN' })}` });

  const roles = await fetch(`${base}/api/admin/v1/roles`, { headers: authHeader(superAdmin) });
  assert.equal(roles.status, 200);
  const roleList = (await roles.json()).data;
  assert.equal(roleList.length, 2); // Super Admin is the only seeded role
  const superAdminRole = roleList.find((r) => r.key === 'super_admin');

  // Operations Manager has no admin.role.view / admin.user.invite — both gated endpoints refuse it.
  assert.equal((await fetch(`${base}/api/admin/v1/roles`, { headers: authHeader(opsManager) })).status, 403);
  const deniedInvite = await fetch(`${base}/api/admin/v1/admin-users`, {
    method: 'POST', headers: { ...authHeader(opsManager), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'X', email: 'x@arise.test', roleIds: [superAdminRole.id] }),
  });
  assert.equal(deniedInvite.status, 403);

  // Super Admin can invite; the new admin's permissions are the union of the assigned roles.
  const invite = await fetch(`${base}/api/admin/v1/admin-users`, {
    method: 'POST', headers: { ...authHeader(superAdmin), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Priya', email: 'priya@arise.test', roleIds: [superAdminRole.id] }),
  });
  assert.equal(invite.status, 201);
  const created = await User.findOne({ email: 'priya@arise.test' }).lean();
  assert.deepEqual(created.permissions, ['*']);
  assert.deepEqual(created.roleIds, [superAdminRole.id]);
  assert.equal(created.status, 'INVITED');
});

test('auth: login (no 2FA on any audience), /me, refresh rotation and logout', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { encryptField, hashPassword, sha256 } = await import('../src/shared/utils/crypto.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  await User.init();

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const cookieOf = (res) => res.headers.get('set-cookie')?.split(';')[0];

  const seller = await Seller.create({ storeName: 'Nova Essentials', status: 'ACTIVE' });
  const sellerUser = await User.create({
    role: 'SELLER', email: 'owner@nova.test', phone: '9876500001',
    passwordHash: await hashPassword('Arise@123456'), sellerId: String(seller._id), status: 'ACTIVE',
  });

  // Wrong audience: a seller account cannot log in through the admin endpoint.
  assert.equal((await post('/api/admin/v1/auth/login', { email: 'owner@nova.test', password: 'Arise@123456' })).status, 401);
  // Wrong password.
  assert.equal((await post('/api/seller/v1/auth/login', { email: 'owner@nova.test', password: 'nope12345' })).status, 401);

  // Login goes straight to a session — no 2FA stage for any audience.
  const loginRes = await post('/api/seller/v1/auth/login', { email: 'owner@nova.test', password: 'Arise@123456' });
  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.equal(loginBody.data.stage, undefined); // only present for a challenge, never for a session
  assert.equal(loginBody.data.user.role, 'SELLER');
  const refreshCookie = cookieOf(loginRes);
  assert.match(refreshCookie, /^refresh_token=/);

  const me = await fetch(`${base}/api/seller/v1/me`, { headers: { authorization: `Bearer ${loginBody.data.accessToken}` } });
  assert.equal((await me.json()).data.email, 'owner@nova.test');

  const refreshed = await post('/api/seller/v1/auth/refresh', {}, { cookie: refreshCookie });
  assert.equal(refreshed.status, 200);
  const refreshedBody = (await refreshed.json()).data;
  assert.notEqual(refreshedBody.accessToken, loginBody.data.accessToken);
  assert.equal(refreshedBody.user.email, 'owner@nova.test'); // the frontend's session bootstrap requires this

  const loggedOut = await post('/api/seller/v1/auth/logout', {}, { cookie: cookieOf(refreshed) });
  assert.equal(loggedOut.status, 200);
  assert.equal((await post('/api/seller/v1/auth/refresh', {}, { cookie: cookieOf(refreshed) })).status, 401);

  // Suspended account: generic-looking 403, no session issued.
  await User.updateOne({ _id: sellerUser._id }, { $set: { status: 'SUSPENDED' } });
  assert.equal((await post('/api/seller/v1/auth/login', { email: 'owner@nova.test', password: 'Arise@123456' })).status, 403);

  // Seller not yet approved: blocked even with a correct password.
  const pendingSeller = await Seller.create({ storeName: 'Pending Co', status: 'UNDER_REVIEW' });
  await User.create({
    role: 'SELLER', email: 'owner@pending.test', phone: '9876500002',
    passwordHash: await hashPassword('Arise@123456'), sellerId: String(pendingSeller._id), status: 'ACTIVE',
  });
  assert.equal((await post('/api/seller/v1/auth/login', { email: 'owner@pending.test', password: 'Arise@123456' })).status, 403);

  // A seller enrolled in 2FA before it was removed still logs straight in: the switch is
  // global (TWO_FACTOR_ROLES), not per-account.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  await User.create({
    role: 'SELLER', email: 'owner@2fa.test', phone: '9876500003',
    passwordHash: await hashPassword('Arise@123456'), sellerId: String(seller._id), status: 'ACTIVE',
    twoFactor: { enrolled: true, secret: encryptField(secret), backupCodes: [{ codeHash: sha256('BACKUP01') }] },
  });
  const previouslyEnrolledLogin = await post('/api/seller/v1/auth/login', { email: 'owner@2fa.test', password: 'Arise@123456' });
  const previouslyEnrolledBody = (await previouslyEnrolledLogin.json()).data;
  assert.equal(previouslyEnrolledBody.stage, undefined);
  assert.ok(previouslyEnrolledBody.accessToken);
});

test('audit log is append-only and redacts secrets', opts, async () => {
  const { recordAudit } = await import('../src/infrastructure/audit/audit.js');
  const { AuditLog } = await import('../src/infrastructure/audit/audit.model.js');
  const entry = await recordAudit({
    action: 'seller.approved',
    subjectType: 'seller',
    subjectId: 's1',
    after: { status: 'APPROVED', bankAccountNumber: '999' },
    actor: { userId: 'admin1', role: 'ADMIN' },
  });
  assert.equal(entry.after.bankAccountNumber, '[REDACTED]');
  await assert.rejects(AuditLog.updateOne({ _id: entry._id }, { $set: { action: 'x' } }), /append-only/);
  await assert.rejects(AuditLog.deleteMany({}), /append-only/);
});

test('admin brands: publishes brands idempotently, lists them and rejects duplicates', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { AuditLog } = await import('../src/infrastructure/audit/audit.model.js');
  const { IdempotencyRecord } = await import('../src/infrastructure/idempotency/idempotency.model.js');
  const { Brand } = await import('../src/modules/catalog/infrastructure/persistence/brand.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  await Promise.all([User.init(), Category.init(), Brand.init(), AuditLog.init(), IdempotencyRecord.init()]);

  const [admin, viewer] = await User.create([
    {
      role: 'ADMIN', email: 'brand-flow@arise.test', status: 'ACTIVE',
      permissions: ['catalog.brand.view', 'catalog.brand.create', 'catalog.brand.edit', 'catalog.brand.delete'],
    },
    {
      role: 'ADMIN', email: 'brand-viewer@arise.test', status: 'ACTIVE',
      permissions: ['catalog.brand.view'],
    },
  ]);
  const rootId = new mongoose.Types.ObjectId();
  await Category.create({
    _id: rootId,
    name: 'Integration Brand Fashion',
    nameKey: 'integration brand fashion',
    slug: 'integration-brand-fashion',
    parentId: null,
    rootId,
    level: 1,
    sortOrder: 99,
  });

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/v1/brands`;
  const tokenFor = (user) => signAccessToken({ sub: String(user._id), role: 'ADMIN' });
  const call = (path, { method = 'GET', body, token = tokenFor(admin), key } = {}) => fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = {
    name: 'Integration Allen Solly',
    rootCategory: 'Integration Brand Fashion',
    ownerType: 'BRAND_OWNER',
    gated: true,
    imageUrl: 'https://cdn.example.com/brands/allen-solly.png',
  };

  const createdResponse = await call('/', { method: 'POST', body: payload, key: 'brand-create-0001' });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;
  assert.equal(created.status, 'VERIFIED');
  assert.equal(created.rootCategoryId, String(rootId));
  assert.equal(created.authorisedSellerCount, 0);

  await Brand.updateOne({ _id: created.id }, { $set: { status: 'PENDING' } });
  const updatedResponse = await call(`/${created.id}`, {
    method: 'PATCH',
    body: { name: 'Integration Puma', gated: false, version: created.version },
  });
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).data;
  assert.equal(updated.name, 'Integration Puma');
  assert.equal(updated.status, 'VERIFIED');
  assert.equal(updated.version, 2);

  const stale = await call(`/${created.id}`, {
    method: 'PATCH', body: { name: 'Stale Puma', version: created.version },
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'VERSION_CONFLICT');

  const replay = await call('/', { method: 'POST', body: payload, key: 'brand-create-0001' });
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get('idempotent-replayed'), 'true');
  assert.equal(await Brand.countDocuments({}), 1);

  const duplicate = await call('/', {
    method: 'POST', body: { ...payload, name: ' integration  puma ' }, key: 'brand-create-0002',
  });
  assert.equal(duplicate.status, 422);
  assert.ok((await duplicate.json()).error.fieldErrors.name);

  const forcedStatus = await call('/', {
    method: 'POST', body: { ...payload, name: 'Status Bypass', status: 'VERIFIED' }, key: 'brand-create-0003',
  });
  assert.equal(forcedStatus.status, 422);

  const denied = await call('/', {
    method: 'POST', body: { name: 'Denied Brand' }, token: tokenFor(viewer), key: 'brand-create-0004',
  });
  assert.equal(denied.status, 403);

  const listedResponse = await call('/?q=Puma&status=VERIFIED&gated=false');
  assert.equal(listedResponse.status, 200);
  const listed = await listedResponse.json();
  assert.equal(listed.data[0].id, created.id);
  assert.equal(listed.meta.total, 1);
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.brand.create', subjectId: created.id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.brand.edit', subjectId: created.id }), 1);

  await Brand.updateOne({ _id: created.id }, { $set: { productCount: 1 } });
  const inUse = await call(`/${created.id}`, { method: 'DELETE' });
  assert.equal(inUse.status, 409);
  assert.equal((await inUse.json()).error.code, 'BRAND_IN_USE');

  await Brand.updateOne({ _id: created.id }, { $set: { productCount: 0 } });
  const deleted = await call(`/${created.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await deleted.json()).data, { ok: true });
  assert.equal(await Brand.countDocuments({ _id: created.id }), 0);
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.brand.delete', subjectId: created.id }), 1);
});

test('admin size charts: validates, scopes, publishes to sellers and protects charts in use', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { AuditLog } = await import('../src/infrastructure/audit/audit.model.js');
  const { IdempotencyRecord } = await import('../src/infrastructure/idempotency/idempotency.model.js');
  const { SizeChart } = await import('../src/modules/catalog/infrastructure/persistence/sizeChart.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  await Promise.all([User.init(), Category.init(), SizeChart.init(), AuditLog.init(), IdempotencyRecord.init()]);

  const [admin, viewer, seller] = await User.create([
    {
      role: 'ADMIN', email: 'sizechart-flow@arise.test', status: 'ACTIVE',
      permissions: ['catalog.sizechart.view', 'catalog.sizechart.create', 'catalog.sizechart.edit', 'catalog.sizechart.delete'],
    },
    { role: 'ADMIN', email: 'sizechart-viewer@arise.test', status: 'ACTIVE', permissions: ['catalog.sizechart.view'] },
    { role: 'SELLER', email: 'sizechart-seller@arise.test', status: 'ACTIVE' },
  ]);
  const rootId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();
  await Category.create([
    {
      _id: rootId, name: 'Integration Apparel', nameKey: 'integration apparel', slug: 'integration-apparel',
      parentId: null, rootId, level: 1, sortOrder: 100,
    },
    {
      _id: categoryId, name: 'Integration Shirts', nameKey: 'integration shirts', slug: 'integration-shirts',
      parentId: rootId, rootId, level: 3, sortOrder: 1,
    },
  ]);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user, role = user.role) => signAccessToken({ sub: String(user._id), role });
  const call = (path, { method = 'GET', body, token = tokenFor(admin), key } = {}) => fetch(`${origin}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = {
    name: 'Integration Men Shirts', unit: 'in', categoryId: String(categoryId),
    columns: ['Size', 'Chest', 'Length'],
    rows: [['38', '40', '28'], ['40', '42', '29']],
  };

  const createdResponse = await call('/api/admin/v1/size-charts', {
    method: 'POST', body: payload, key: 'size-chart-create-0001',
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;
  assert.equal(created.categoryName, 'Integration Shirts');
  assert.equal(created.version, 1);

  const replay = await call('/api/admin/v1/size-charts', {
    method: 'POST', body: payload, key: 'size-chart-create-0001',
  });
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get('idempotent-replayed'), 'true');

  const invalid = await call('/api/admin/v1/size-charts', {
    method: 'POST', body: { ...payload, name: 'Invalid Duplicate Sizes', rows: [['38', '40', '28'], [' 38 ', '42', '29']] },
    key: 'size-chart-create-0002',
  });
  assert.equal(invalid.status, 422);
  assert.ok((await invalid.json()).error.fieldErrors.rows);

  const listed = await call('/api/admin/v1/size-charts');
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).data.some((chart) => chart.id === created.id));

  const sellerResponse = await call(`/api/seller/v1/catalog/categories/${categoryId}/attributes`, {
    token: tokenFor(seller),
  });
  assert.equal(sellerResponse.status, 200);
  assert.deepEqual((await sellerResponse.json()).data.sizeCharts, [{ id: created.id, name: created.name }]);

  const updatedResponse = await call(`/api/admin/v1/size-charts/${created.id}`, {
    method: 'PATCH', body: { unit: 'cm', version: created.version },
  });
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).data;
  assert.equal(updated.unit, 'cm');
  assert.equal(updated.version, 2);

  const stale = await call(`/api/admin/v1/size-charts/${created.id}`, {
    method: 'PATCH', body: { name: 'Stale Chart', version: created.version },
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'VERSION_CONFLICT');

  const denied = await call('/api/admin/v1/size-charts', {
    method: 'POST', body: { ...payload, name: 'Denied Chart' }, token: tokenFor(viewer), key: 'size-chart-create-0003',
  });
  assert.equal(denied.status, 403);

  await SizeChart.updateOne({ _id: created.id }, { $set: { productCount: 1 } });
  const inUse = await call(`/api/admin/v1/size-charts/${created.id}`, { method: 'DELETE' });
  assert.equal(inUse.status, 409);
  assert.equal((await inUse.json()).error.code, 'SIZECHART_IN_USE');

  await SizeChart.updateOne({ _id: created.id }, { $set: { productCount: 0 } });
  const deleted = await call(`/api/admin/v1/size-charts/${created.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await deleted.json()).data, { ok: true });
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.sizechart.create', subjectId: created.id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.sizechart.edit', subjectId: created.id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: 'catalog.sizechart.delete', subjectId: created.id }), 1);
});

test('admin categories: creates three levels, inherits policies, builds the tree and enforces conflicts', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  await Promise.all([User.init(), Category.init()]);

  const admin = await User.create({
    role: 'ADMIN',
    email: 'category-flow@arise.test',
    status: 'ACTIVE',
    permissions: [
      'catalog.category.view',
      'catalog.category.create',
      'catalog.category.edit',
      'catalog.category.delete',
    ],
  });
  const token = signAccessToken({ sub: String(admin._id), role: 'ADMIN' });
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/v1/categories`;
  const call = (path, { method = 'GET', body } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const rootResponse = await call('/', {
    method: 'POST',
    body: {
      name: 'Integration Fashion', color: '#7c3aed', returnWindowDays: 14,
      returnTypes: ['REFUND'], gated: true, codAllowed: false, gstRate: 5, hsnCode: '6205',
    },
  });
  assert.equal(rootResponse.status, 201);
  const root = (await rootResponse.json()).data;
  assert.equal(root.level, 1);
  assert.equal(root.color, '#7c3aed');

  const levelTwoResponse = await call('/', {
    method: 'POST', body: { name: 'Integration Men', parentId: root.id },
  });
  assert.equal(levelTwoResponse.status, 201);
  const levelTwo = (await levelTwoResponse.json()).data;
  assert.equal(levelTwo.level, 2);
  assert.equal(levelTwo.returnWindowDays, 14);
  assert.equal(levelTwo.gated, true);
  assert.equal(levelTwo.codAllowed, false);

  const leafResponse = await call('/', {
    method: 'POST', body: { name: 'Integration Shirts', parentId: levelTwo.id },
  });
  assert.equal(leafResponse.status, 201);
  const leaf = (await leafResponse.json()).data;
  assert.equal(leaf.level, 3);

  const tooDeep = await call('/', {
    method: 'POST', body: { name: 'Integration Too Deep', parentId: leaf.id },
  });
  assert.equal(tooDeep.status, 422);

  const duplicate = await call('/', {
    method: 'POST', body: { name: ' integration shirts ', parentId: levelTwo.id },
  });
  assert.equal(duplicate.status, 422);

  const treeResponse = await call('/tree');
  assert.equal(treeResponse.status, 200);
  const tree = (await treeResponse.json()).data;
  const createdRoot = tree.find((category) => category.id === root.id);
  assert.equal(createdRoot.children[0].children[0].id, leaf.id);

  const updatedResponse = await call(`/${root.id}`, {
    method: 'PATCH', body: { name: 'Integration Style', color: '#2563eb', version: root.version },
  });
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).data;
  assert.equal(updated.version, 2);
  assert.equal(updated.slug, 'integration-style');

  const stale = await call(`/${root.id}`, {
    method: 'PATCH', body: { name: 'Stale name', version: root.version },
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'VERSION_CONFLICT');

  const deleteParent = await call(`/${root.id}`, { method: 'DELETE' });
  assert.equal(deleteParent.status, 409);
  assert.equal((await deleteParent.json()).error.code, 'CATEGORY_HAS_CHILDREN');
});

test('attributes: admin CRUD, category assignment, seller reads and usage safeguards', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Attribute } = await import('../src/modules/attribute/infrastructure/persistence/attribute.model.js');
  const { AttributeSet } = await import('../src/modules/attribute/infrastructure/persistence/attributeSet.model.js');
  await Promise.all([User.init(), Category.init(), Attribute.init(), AttributeSet.init()]);

  const admin = await User.create({
    role: 'ADMIN', email: 'attribute-flow@arise.test', status: 'ACTIVE',
    permissions: [
      'catalog.attribute.view', 'catalog.attribute.create', 'catalog.attribute.edit', 'catalog.attribute.delete',
      'catalog.category.view', 'catalog.category.create', 'catalog.category.edit',
    ],
  });
  const adminToken = signAccessToken({ sub: String(admin._id), role: 'ADMIN' });
  const sellerToken = signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER' });
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', body, token = adminToken } = {}) => fetch(`${origin}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const attributeResponse = await call('/api/admin/v1/attributes', {
    method: 'POST',
    body: {
      name: 'Integration Colour', code: 'integration_colour', type: 'COLOUR',
      values: ['Black', 'Blue', 'black'], filterable: true, variantDefining: true,
    },
  });
  assert.equal(attributeResponse.status, 201);
  const attribute = (await attributeResponse.json()).data;
  assert.deepEqual(attribute.values.map((value) => value.value), ['Black', 'Blue']);

  const setResponse = await call('/api/admin/v1/attribute-sets', {
    method: 'POST',
    body: { name: 'Integration Apparel', rootName: 'Integration Attribute Fashion', attributeIds: [attribute.id] },
  });
  assert.equal(setResponse.status, 201);
  const set = (await setResponse.json()).data;

  const createCategory = async (name, parentId = null, extra = {}) => {
    const response = await call('/api/admin/v1/categories', { method: 'POST', body: { name, parentId, ...extra } });
    assert.equal(response.status, 201);
    return (await response.json()).data;
  };
  const root = await createCategory('Integration Attribute Fashion');
  const middle = await createCategory('Integration Attribute Men', root.id);
  const leaf = await createCategory('Integration Attribute Shirts', middle.id, { attributeSetId: set.id });

  const detail = await call(`/api/admin/v1/categories/${leaf.id}`);
  const detailBody = await detail.json();
  assert.equal(detailBody.meta.attributeSet.id, set.id);
  assert.equal(detailBody.meta.attributes[0].code, 'integration_colour');

  const sellerAttributes = await call(`/api/seller/v1/catalog/categories/${leaf.id}/attributes`, { token: sellerToken });
  assert.equal(sellerAttributes.status, 200);
  assert.deepEqual((await sellerAttributes.json()).data.attributes[0].values.map((value) => value.value), ['Black', 'Blue']);

  const editedResponse = await call(`/api/admin/v1/attributes/${attribute.id}`, {
    method: 'PATCH', body: { values: ['Black'], version: attribute.version },
  });
  assert.equal(editedResponse.status, 200);
  const edited = (await editedResponse.json()).data;
  assert.equal(edited.values.find((value) => value.value === 'Blue').active, false);

  const sellerAfterEdit = await call(`/api/seller/v1/catalog/categories/${leaf.id}/attributes`, { token: sellerToken });
  assert.deepEqual((await sellerAfterEdit.json()).data.attributes[0].values.map((value) => value.value), ['Black']);

  const breakVariants = await call(`/api/admin/v1/attributes/${attribute.id}`, {
    method: 'PATCH', body: { variantDefining: false, version: edited.version },
  });
  assert.equal(breakVariants.status, 409);
  assert.equal((await breakVariants.json()).error.code, 'ATTRIBUTE_IN_USE');

  const stale = await call(`/api/admin/v1/attributes/${attribute.id}`, {
    method: 'PATCH', body: { name: 'Stale', version: attribute.version },
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, 'VERSION_CONFLICT');
  assert.equal((await call(`/api/admin/v1/attributes/${attribute.id}`, { method: 'DELETE' })).status, 409);
  assert.equal((await call(`/api/admin/v1/attribute-sets/${set.id}`, { method: 'DELETE' })).status, 409);

  const detached = await call(`/api/admin/v1/categories/${leaf.id}`, {
    method: 'PATCH', body: { attributeSetId: null, version: leaf.version },
  });
  assert.equal(detached.status, 200);
  assert.equal((await call(`/api/admin/v1/attribute-sets/${set.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call(`/api/admin/v1/attributes/${attribute.id}`, { method: 'DELETE' })).status, 200);
});

test('seller settings: profile update, holiday mode and step-up-protected bank CRUD', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { hashPassword } = await import('../src/shared/utils/crypto.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/seller/v1/settings`;

  const seller = await Seller.create({ storeName: 'Bank Co', status: 'ACTIVE' });
  const sellerId = String(seller._id);
  const owner = await User.create({
    role: 'SELLER', email: 'owner@bank.test', phone: '9876500010',
    passwordHash: await hashPassword('Arise@123456'), sellerId, status: 'ACTIVE',
  });
  const authFor = (user, role = 'SELLER') => ({
    authorization: `Bearer ${signAccessToken({ sub: String(user._id), role, sellerId })}`,
    'content-type': 'application/json',
  });
  const call = (method, path, body, headers) =>
    fetch(`${base}${path}`, { method, headers: headers ?? authFor(owner), body: body && JSON.stringify(body) });
  const bank = { accountHolder: 'Bank Co', accountNumber: '123456789012', ifsc: 'hdfc0001234', bankName: 'HDFC', branch: 'Pune' };

  assert.equal((await call('PATCH', '/profile', { storeName: 'Renamed Co' })).status, 200);
  const profile = (await (await call('GET', '/profile')).json()).data.seller;
  assert.equal(profile.storeName, 'Renamed Co');
  assert.equal((await call('PATCH', '/profile', { storeName: 'x' })).status, 422);

  assert.equal((await call('POST', '/vacation', { on: true })).status, 200);
  assert.equal((await (await call('GET', '/profile')).json()).data.seller.vacationMode, true);

  assert.deepEqual((await (await call('GET', '/bank')).json()).data, { account: null });
  assert.equal((await call('PUT', '/bank/account', bank)).status, 403); // no step-up token
  assert.equal((await call('POST', '/security/reauth', { password: 'wrong-password' })).status, 403);
  const { token } = (await (await call('POST', '/security/reauth', { password: 'Arise@123456' })).json()).data;
  const stepped = { ...authFor(owner), 'x-step-up-token': token };

  const saved = await call('PUT', '/bank/account', bank, stepped);
  assert.equal(saved.status, 200);
  const { account } = (await saved.json()).data;
  assert.equal(account.accountNumber, '••••••••9012');
  assert.equal(account.pennyDropStatus, 'PENDING');
  assert.equal((await Seller.findById(sellerId).lean()).bank.ifsc, 'HDFC0001234');
  assert.equal((await call('PUT', '/bank/account', { ...bank, ifsc: 'bad' }, stepped)).status, 422);

  const staff = await User.create({ role: 'SELLER_STAFF', email: 'staff@bank.test', phone: '9876500011', sellerId, status: 'ACTIVE' });
  assert.equal((await call('GET', '/bank', undefined, authFor(staff, 'SELLER_STAFF'))).status, 200);
  assert.equal((await call('PATCH', '/profile', { storeName: 'Hacked' }, authFor(staff, 'SELLER_STAFF'))).status, 403);

  assert.equal((await call('DELETE', '/bank/account', undefined, stepped)).status, 200);
  assert.deepEqual((await (await call('GET', '/bank')).json()).data, { account: null });
});

test('customer categories: show only ACTIVE categories in the tree, home tabs and detail panes', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  await Category.init();

  const row = (name, parent, extra = {}) => {
    const _id = new mongoose.Types.ObjectId();
    return {
      _id, name, nameKey: `cust ${name}`.toLowerCase(), slug: `cust-${name}`.toLowerCase(),
      parentId: parent?._id ?? null, rootId: parent?.rootId ?? _id, level: (parent?.level ?? 0) + 1,
      sortOrder: 1, ...extra,
    };
  };
  const root = row('Cust Fashion', null, { color: '#7c3aed', icon: 'tag', imageUrl: 'https://cdn.example.com/f.png' });
  const men = row('Cust Men', root);
  const shirts = row('Cust Shirts', men);
  const bare = row('Cust Women', root);
  const hidden = row('Cust Hidden', null, { status: 'HIDDEN' });
  const underHidden = row('Cust Under Hidden', hidden);
  await Category.create([root, men, shirts, bare, hidden, underHidden]);
  const { CategoryTab } = await import('../src/modules/admin/infrastructure/persistence/homeLayout.models.js');
  await CategoryTab.create({ categoryId: root._id, label: root.name, icon: 'grid', gradient: ['#FFCB9D', '#FFFFFF'], order: 0 });

  const { Banner } = await import('../src/modules/admin/infrastructure/persistence/banner.model.js');
  const img = (n) => ({ mobile_16_9: `https://cdn.example.com/uploads/cms/${n}.png`, tile_1_1: 'https://x/t.png', web: 'https://x/w.png' });
  const day = 86_400_000;
  const banner = (name, priority, extra) => ({
    name, kind: 'HERO', images: img(name), altText: name, placements: ['HOME_HERO'], priority,
    startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day), createdBy: 'test', ...extra,
  });
  await Banner.create([
    banner('hero-second', 2), banner('hero-first', 1),
    banner('hero-expired', 0, { endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - day) }),
    banner('hero-wrong-slot', 0, { placements: ['OFFERS_PAGE'] }),
    banner('hero-cat', 0, { placements: ['CATEGORY_HERO'], categoryIds: [root._id] }),
    banner('hero-other-cat', 0, { placements: ['CATEGORY_HERO'], categoryIds: [hidden._id] }),
  ]);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`);
    return { status: response.status, body: await response.json() };
  };

  const tree = (await get('/categories/tree')).body.data.filter((c) => c.name.startsWith('Cust '));
  assert.deepEqual(tree.map((c) => c.name), ['Cust Fashion']);
  assert.equal(tree[0].icon, 'tag');

  const home = (await get('/home')).body.data;
  assert.deepEqual(home.sections[0].items.map((i) => i.altText), ['hero-first', 'hero-second']);
  assert.equal(home.sections[0].type, 'HERO');
  assert.deepEqual(home.header.brandTabs.map((b) => b.label), ['Arise', 'Deals']);
  assert.deepEqual(home.header.searchPlaceholders, ['Search products']);
  assert.equal(home.header.categoryTabs[0].id, 'foryou');
  const tab = home.header.categoryTabs.find((c) => c.label === 'Cust Fashion');
  assert.deepEqual(tab.gradient, ['#7c3aed', '#FFFFFF']);
  assert.equal(tab.icon, 'tag', 'the current category icon wins over the tab\'s stale copied icon');
  await CategoryTab.updateOne(
    { categoryId: root._id },
    { $set: { gradient: ['#112233', '#FFFFFF'], gradientOverridden: true } },
  );
  const overriddenTab = (await get('/home')).body.data.header.categoryTabs.find((c) => c.label === 'Cust Fashion');
  assert.deepEqual(overriddenTab.gradient, ['#112233', '#FFFFFF'], 'an explicit Home Layout gradient still wins');

  const detail = (await get(`/categories/${root._id}`)).body.data;
  assert.equal(detail.heroBanner.title, 'hero-cat'); // the category's own banner, not its image
  const categoryHome = (await get(`/home?categoryId=${root._id}`)).body.data;
  assert.deepEqual(categoryHome.sections.find((s) => s.type === 'HERO').items.map((i) => i.altText), ['hero-cat']);
  assert.equal((await get('/home?categoryId=foryou')).body.data.sections[0].items.length, 2);
  assert.deepEqual(detail.sections.map((s) => [s.title, s.items.map((i) => i.label)]), [
    ['Cust Men', ['Cust Shirts']],
    ['Cust Fashion', ['Cust Women']],
  ]);
  assert.equal((await get(`/categories/${hidden._id}`)).status, 404);
  assert.equal((await get(`/categories/${underHidden._id}`)).status, 404);
});

test('customer products: only admin-approved (LIVE) products in visible categories are served', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init()]);

  const catRow = (name, parent, extra = {}) => {
    const _id = new mongoose.Types.ObjectId();
    return {
      _id, name, nameKey: `prod ${name}`.toLowerCase(), slug: `prod-${name}`.toLowerCase(),
      parentId: parent?._id ?? null, rootId: parent?.rootId ?? _id, level: (parent?.level ?? 0) + 1, sortOrder: 1, ...extra,
    };
  };
  const root = catRow('Prod Root', null);
  const mid = catRow('Prod Mid', root);
  const leaf = catRow('Prod Leaf', mid);
  const hiddenRoot = catRow('Prod Hidden Root', null, { status: 'HIDDEN' });
  const hiddenLeaf = catRow('Prod Hidden Leaf', catRow('Prod Hidden Mid', hiddenRoot));
  await Category.create([root, mid, leaf, hiddenRoot, hiddenLeaf]);

  const make = async (title, status, category, { stock = 5, price = 1000 } = {}) => {
    const product = await Product.create({
      title, status, categoryId: category._id, rootCategoryId: category.rootId, categoryPath: `Prod Root › Prod Mid › ${category.name}`,
      brandName: 'Acme', images: ['public/products/s1/a.png'], createdBySellerId: 's1',
    });
    const variant = await Variant.create({
      productId: product._id, sku: `SKU-${title}`, attributes: { shoe_size: 'UK-8', color: 'Black' }, label: 'UK-8',
      weightG: 100, dimsCm: { l: 1, w: 1, h: 1 },
    });
    await Offer.create({
      productId: product._id, variantId: variant._id, sellerId: 's1', sellingPricePaise: price, mrpPaise: price + 500, stock, status,
    });
    return product;
  };
  const live = await make('Cust Live Shoe', 'LIVE', leaf, { price: 1300 });
  const pending = await make('Cust Pending Shoe', 'QC_PENDING', leaf);
  const rejected = await make('Cust Rejected Shoe', 'REJECTED', leaf);
  const inHidden = await make('Cust Hidden Cat Shoe', 'LIVE', hiddenLeaf);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`);
    return { status: response.status, body: await response.json() };
  };

  const found = (await get('/search?q=Cust')).body.data;
  assert.deepEqual(found.items.map((item) => item.name), ['Cust Live Shoe']);
  assert.equal(found.items[0].pricePaise, 1300);
  assert.equal((await get(`/search?categoryId=${root._id}`)).body.data.total, 1);
  assert.equal((await get(`/search?categoryId=${hiddenRoot._id}`)).body.data.total, 0);
  assert.equal((await get('/search?q=Cust&priceRangeId=p1')).body.data.total, 0);

  const detail = (await get(`/products/${live._id}`)).body.data;
  assert.deepEqual(detail.sizes, ['UK-8']);
  assert.equal(detail.color, 'Black');
  assert.deepEqual(detail.variants.map((v) => [v.size, v.pricePaise, v.stock]), [['UK-8', 1300, 5]]);
  for (const hidden of [pending, rejected, inHidden]) assert.equal((await get(`/products/${hidden._id}`)).status, 404);

  const feed = (await get('/home')).body.data.sections.find((section) => section.type === 'PRODUCT_FEED');
  assert.deepEqual(feed.items.map((item) => item.name), ['Cust Live Shoe']);

  // home sections: public suggestions for everyone, "still looking" only for a customer who opened a product
  const { listHomeSections, recordProductView } = await import('../src/modules/product/application/customerCatalog.service.js');
  const anonymous = await listHomeSections();
  assert.deepEqual([anonymous.recentlyViewed.length, anonymous.suggested.map((item) => item.name)], [0, ['Cust Live Shoe']]);
  await recordProductView('cust-1', String(live._id));
  await recordProductView('cust-1', String(live._id)); // reopening must not duplicate
  const personal = await listHomeSections({ userId: 'cust-1' });
  assert.deepEqual(personal.recentlyViewed.map((item) => item.title), ['Cust Live Shoe']);
  assert.deepEqual(personal.suggested.map((item) => item.name), ['Cust Live Shoe']); // already-seen items go last, but still fill a small catalogue
});

test('banner ads: priced slots, race-safe date locks, payment confirmation, refund on rejection', opts, async () => {
  const svc = await import('../src/modules/bannerAd/application/bannerAd.service.js');
  const { BannerBooking, BannerSlot, BannerSlotDay } = await import('../src/modules/bannerAd/infrastructure/persistence/bannerAd.models.js');
  const { Media } = await import('../src/modules/media/infrastructure/persistence/media.model.js');
  const { paymentGateway } = await import('../src/infrastructure/external/payment/index.js');
  await Promise.all([BannerSlot.init(), BannerBooking.init(), BannerSlotDay.init()]);

  let orders = 0;
  const refunds = [];
  paymentGateway.createPayment = async ({ amountPaise }) => ({ providerOrderId: `order_${(orders += 1)}`, amountPaise, currency: 'INR', keyId: 'rzp_test' });
  paymentGateway.refund = async ({ providerPaymentId, amountPaise }) => (refunds.push({ providerPaymentId, amountPaise }), { providerRefundId: `rfnd_${refunds.length}` });
  paymentGateway.verifyCheckout = ({ signature }) => signature === 'good';

  const admin = { userId: 'admin-1', role: 'ADMIN' };
  const slot = await svc.createSlot({ name: 'Home top', categoryId: null, description: 'Top', dailyRatePaise: 100_000, mobileWidth: 1080, mobileHeight: 1080, enabled: true }, admin);
  await assert.rejects(svc.createSlot({ name: 'home TOP', description: '', dailyRatePaise: 1, mobileWidth: 100, mobileHeight: 100, enabled: true }, admin), { code: 'VALIDATION_ERROR' });

  await assert.rejects(svc.createSlot({ name: 'Ghost cat', description: '', categoryId: String(new mongoose.Types.ObjectId()), dailyRatePaise: 1, mobileWidth: 100, mobileHeight: 100, enabled: true }, admin), { code: 'VALIDATION_ERROR' });
  const media = async (owner, kind, width, height) => String((await Media.create({ ownerId: owner, kind, status: 'READY', key: `public/products/${owner}/${kind}.png`, width, height, fileName: `${kind}.png` }))._id);
  const input = async (owner, startsOn, endsOn, size = [1080, 1080]) => ({
    campaignName: 'Campaign', placementId: slot.id, startsOn, endsOn, destinationType: 'SHOP', destinationValue: owner,
    mobileCreative: { mediaId: await media(owner, 'BANNER_AD_MOBILE', ...size) },
  });

  // wrong creative size is rejected before any dates are held
  await assert.rejects(svc.createBooking('sellerA', await input('sellerA', '2099-03-01', '2099-03-05', [1000, 400]), {}), { code: 'VALIDATION_ERROR' });
  assert.equal(await BannerSlotDay.countDocuments(), 0);

  const a = await svc.createBooking('sellerA', await input('sellerA', '2099-03-01', '2099-03-05'), {});
  assert.equal(a.booking.totalPaise, 5 * 100_000 * 1.18);
  assert.equal(a.booking.status, 'PENDING_PAYMENT');
  assert.equal(a.payment.providerOrderId, 'order_1');

  // overlapping dates are refused and leave no stray locks
  await assert.rejects(svc.createBooking('sellerB', await input('sellerB', '2099-03-05', '2099-03-07'), {}), { code: 'SLOT_BOOKED' });
  assert.equal(await BannerSlotDay.countDocuments(), 5);

  // two sellers racing for the same free days: exactly one wins
  const race = await Promise.allSettled([
    svc.createBooking('sellerA', await input('sellerA', '2099-04-01', '2099-04-03'), {}),
    svc.createBooking('sellerB', await input('sellerB', '2099-04-02', '2099-04-04'), {}),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(await BannerSlotDay.countDocuments({ day: { $regex: '^2099-04' } }), race.find((r) => r.status === 'fulfilled').value.booking.days);

  // payment: a bad signature is refused, a good one queues the booking for review (idempotently)
  await assert.rejects(svc.verifyBookingPayment('sellerA', a.booking.id, { providerPaymentId: 'pay_1', signature: 'bad' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(svc.verifyBookingPayment('sellerB', a.booking.id, { providerPaymentId: 'pay_1', signature: 'good' }), { code: 'NOT_FOUND' });
  const paid = await svc.verifyBookingPayment('sellerA', a.booking.id, { providerPaymentId: 'pay_1', signature: 'good' });
  assert.deepEqual([paid.status, paid.paymentStatus], ['PENDING_REVIEW', 'PAID']);
  assert.equal((await svc.verifyBookingPayment('sellerA', a.booking.id, { providerPaymentId: 'pay_1', signature: 'good' })).status, 'PENDING_REVIEW');
  assert.equal((await svc.listAdminRequests({ page: 1, pageSize: 25, status: [], sortField: 'submittedAt', sortDirection: -1 })).data.length, 1);

  // rejection refunds the full amount once and frees the dates
  await assert.rejects(svc.decideBooking(a.booking.id, { decision: 'APPROVED' }, admin).then(() => svc.decideBooking(a.booking.id, { decision: 'REJECTED', reason: 'x' }, admin)), { code: 'ALREADY_DECIDED' });
  // the approved booking feeds the customer home carousel only on its own days
  const live = await svc.listLiveAdBanners({ today: '2099-03-02' });
  assert.deepEqual(live.map((item) => item.target), [{ type: 'SHOP', id: 'sellerA' }]);
  assert.equal((await svc.listLiveAdBanners({ today: '2099-03-06' })).length, 0);
  const b = await svc.createBooking('sellerB', await input('sellerB', '2099-05-01', '2099-05-02'), {});
  await svc.verifyBookingPayment('sellerB', b.booking.id, { providerPaymentId: 'pay_2', signature: 'good' });
  const rejected = await svc.decideBooking(b.booking.id, { decision: 'REJECTED', reason: 'Unreadable text' }, admin);
  assert.deepEqual([rejected.status, rejected.paymentStatus, rejected.refundReference], ['REJECTED', 'REFUNDED', 'rfnd_1']);
  assert.deepEqual(refunds, [{ providerPaymentId: 'pay_2', amountPaise: b.booking.totalPaise }]);
  assert.equal(await BannerSlotDay.countDocuments({ bookingId: b.booking.id }), 0);

  // an unpaid hold lapses and frees its dates; deleting a slot with paid bookings is blocked
  const held = await svc.createBooking('sellerB', await input('sellerB', '2099-06-01', '2099-06-02'), {});
  await BannerBooking.updateOne({ _id: held.booking.id }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
  const [listed] = await svc.listBookableSlots();
  assert.ok(!listed.bookedRanges.some((r) => r.startsOn === '2099-06-01'));
  assert.equal((await BannerBooking.findById(held.booking.id)).status, 'EXPIRED');
  await assert.rejects(svc.deleteSlot(slot.id, admin), { code: 'SLOT_HAS_BOOKINGS' });
});

test('campaigns: seller enters products, admin approves, customers see them at the deal price', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const admin = await import('../src/modules/coupon/application/campaign.service.js');
  const seller = await import('../src/modules/coupon/application/sellerCampaign.service.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { Campaign } = await import('../src/modules/coupon/infrastructure/persistence/campaign.model.js');
  const { CampaignSubmission } = await import('../src/modules/coupon/infrastructure/persistence/campaignSubmission.model.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init(), Campaign.init(), CampaignSubmission.init()]);

  const _id = new mongoose.Types.ObjectId();
  await Category.create({ _id, name: 'Camp Root', nameKey: 'camp root', slug: 'camp-root', parentId: null, rootId: _id, level: 1, sortOrder: 1 });
  const product = await Product.create({
    title: 'Camp Shoe', status: 'LIVE', categoryId: _id, rootCategoryId: _id, categoryPath: 'Camp Root', brandName: 'Acme',
    images: ['public/products/s1/c.png'], createdBySellerId: 's1',
  });
  const variant = await Variant.create({ productId: product._id, sku: 'CAMP-SHOE', label: 'One', weightG: 100, dimsCm: { l: 1, w: 1, h: 1 } });
  await Offer.create({ productId: product._id, variantId: variant._id, sellerId: 's1', sellingPricePaise: 1300, mrpPaise: 1800, stock: 5, status: 'LIVE' });

  const actor = { userId: 'admin-1', name: 'Admin' };
  const campaign = await admin.createCampaign({
    name: 'Camp Flash', type: 'FLASH_DEAL', customerSection: 'FLASH_DEALS_RAIL', tagline: 'Go', minDiscountPct: 30,
    startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000), submissionDeadline: null,
  }, actor);

  // a draft is invisible to sellers; once OPEN it can be joined
  await assert.rejects(seller.getSellerCampaign('s1', campaign.id), { code: 'NOT_FOUND' });
  await admin.changeCampaignStatus(campaign.id, 'OPEN', actor);
  assert.deepEqual((await seller.listSellerCampaigns('s1', { type: [], tab: 'open' })).data.map((row) => row.id), [campaign.id]);
  assert.deepEqual((await seller.listEligibleProducts('s1', campaign.id)).map((item) => [item.title, item.sellingPricePaise, item.stock]), [['Camp Shoe', 1300, 5]]);
  assert.deepEqual(await seller.listEligibleProducts('s2', campaign.id), []);

  const enter = (sellerId, dealPricePaise, stockCommitted = 3) => seller.submitEntries(sellerId, campaign.id, [{ listingId: String(product._id), dealPricePaise, stockCommitted }]);
  await assert.rejects(enter('s1', 1400), /above your current selling price/); // 1300 selling price
  await assert.rejects(enter('s1', 1300), /at least 30% off MRP/); // 28% of 1800
  await assert.rejects(enter('s1', 1000, 6), /only have 5 in stock/);
  await assert.rejects(enter('s2', 1000), /Choose one of your live products/);
  const [entry] = await enter('s1', 1000);
  assert.deepEqual([entry.status, entry.discountPct, entry.mrpPaise], ['PENDING', 44, 1800]);
  await assert.rejects(enter('s1', 1000), /already in this campaign/);
  assert.equal((await seller.listSellerCampaigns('s1', { type: [], tab: 'joined' })).data[0].myProducts, 1);

  // approved entries reach customers once the campaign is running on its dates, even before the admin closes entries
  assert.deepEqual(await admin.decideSubmissions(campaign.id, { submissionIds: [entry.id], decision: 'approve' }, actor), { updated: 1, skipped: 0 });
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`);
    return { status: response.status, body: await response.json() };
  };
  // being placed in the flash rail is not enough: the admin must choose it as a home flash sale
  assert.equal((await get(`/flash-sales/${campaign.id}`)).status, 404);
  assert.ok(!(await get('/home')).body.data.sections.some((section) => section.type === 'FLASH_SALE'));
  const chosen = await admin.setHomeFlashSale(campaign.id, true, actor);
  assert.equal(chosen.homeFlashSale, true);
  assert.equal((await get(`/flash-sales/${campaign.id}`)).body.data.items.length, 1);
  await admin.changeCampaignStatus(campaign.id, 'SCHEDULED', actor);
  await admin.changeCampaignStatus(campaign.id, 'ACTIVE', actor);
  await admin.changeCampaignStatus(campaign.id, 'PAUSED', actor); // a paused campaign leaves the shelf
  assert.equal((await get(`/flash-sales/${campaign.id}`)).status, 404);
  await admin.changeCampaignStatus(campaign.id, 'ACTIVE', actor);
  // a second campaign can hold the slot too, alongside the first, without replacing it; a draft cannot take it
  const other = await admin.createCampaign({ name: 'Camp Other', type: 'OFFER', customerSection: 'OFFERS_PAGE', tagline: '', minDiscountPct: 10, startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000), submissionDeadline: null }, actor);
  await assert.rejects(admin.setHomeFlashSale(other.id, true, actor), { code: 'CAMPAIGN_NOT_ELIGIBLE' });
  await admin.changeCampaignStatus(other.id, 'OPEN', actor);
  await admin.setHomeFlashSale(other.id, true, actor);
  assert.equal((await get(`/flash-sales/${other.id}`)).status, 404); // Camp Other has no approved products
  assert.equal((await get(`/flash-sales/${campaign.id}`)).status, 200); // Camp Flash keeps its own slot

  const flash = (await get(`/flash-sales/${campaign.id}`)).body.data;
  assert.deepEqual(flash.items.map((item) => [item.name, item.pricePaise, item.mrpPaise, item.discountPct]), [['Camp Shoe', 1000, 1800, 44]]);
  const flashSection = (await get('/home')).body.data.sections.find((section) => section.type === 'FLASH_SALE');
  assert.deepEqual(flashSection.items.map((item) => [item.title, item.subtitle]), [['Camp Flash', 'Go']]); // the banner carries the campaign's own name and tagline
  assert.deepEqual((await get('/promotions')).body.data.items.map((item) => [item.title, item.tag]), [['Camp Flash', 'FLASH DEAL']]); // the Deals tab lists every live campaign

  // withdrawing takes it off the shelf at once, and the seller can enter it again
  await seller.withdrawEntry('s1', entry.id);
  assert.equal((await get(`/flash-sales/${campaign.id}`)).status, 404);
  assert.equal((await enter('s1', 900))[0].status, 'PENDING');
});

test('customer profile: edits name/gender/photo, and swaps a phone only after its code is verified', opts, async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join: joinPath } = await import('node:path');
  const profile = await import('../src/modules/identity/application/customerProfile.service.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { AuthChallenge } = await import('../src/modules/identity/infrastructure/persistence/authChallenge.model.js');
  const { sha256 } = await import('../src/shared/utils/crypto.js');
  await Promise.all([User.init(), AuthChallenge.init()]);

  const me = await User.create({ role: 'CUSTOMER', name: 'Asha', phone: '9876500001' });
  await User.create({ role: 'CUSTOMER', name: 'Other', phone: '9876500002' });
  const id = String(me._id);

  let view = await profile.updateCustomerProfile(id, { name: 'Asha K', gender: 'FEMALE' });
  assert.deepEqual([view.name, view.gender, view.phoneMasked, view.pendingVerification], ['Asha K', 'FEMALE', '******0001', null]);

  // a photo must be this customer's own upload, still on disk
  await assert.rejects(profile.updateCustomerProfile(id, { avatarMediaId: 'public/avatars/someone-else/x.png' }), { code: 'VALIDATION_ERROR' });
  const key = `public/avatars/${id}/me.png`;
  await mkdir(joinPath(process.env.UPLOAD_DIR, 'public', 'avatars', id), { recursive: true });
  await writeFile(joinPath(process.env.UPLOAD_DIR, key), 'png');
  assert.match((await profile.updateCustomerProfile(id, { avatarMediaId: key })).avatarUrl, /\/uploads\/avatars\//);

  await assert.rejects(profile.updateCustomerProfile(id, { newPhone: '+91 98765 00002' }), { code: 'CONTACT_IN_USE' });
  await assert.rejects(profile.updateCustomerProfile(id, { newEmail: 'a@x.io', newPhone: '9876500003' }), { code: 'VALIDATION_ERROR' });
  view = await profile.updateCustomerProfile(id, { newPhone: '+91 98765 00003' });
  assert.deepEqual([view.pendingVerification.field, view.pendingVerification.destinationMasked, view.phoneMasked], ['PHONE', '******0003', '******0001']);

  // the code is never returned; set a known one to exercise verification
  await AuthChallenge.updateOne({ _id: view.pendingVerification.challengeId }, { $set: { codeHash: sha256('1234') } });
  await assert.rejects(profile.verifyContactChange(id, { challengeId: view.pendingVerification.challengeId, otp: '0000' }), { code: 'OTP_INVALID' });
  view = await profile.verifyContactChange(id, { challengeId: view.pendingVerification.challengeId, otp: '1234' });
  assert.deepEqual([view.phoneMasked, view.pendingVerification], ['******0003', null]);
  assert.equal((await User.findById(id)).phone, '9876500003');
  await assert.rejects(profile.verifyContactChange(id, { challengeId: String(new mongoose.Types.ObjectId()), otp: '1234' }), { code: 'OTP_EXPIRED' });
});

test('customer addresses: CRUD, ownership and exactly one default', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { AddressBook } = await import('../src/modules/customer/infrastructure/persistence/addressBook.model.js');
  await AddressBook.init();

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1`;
  const token = (id) => signAccessToken({ sub: String(id), role: 'CUSTOMER' });
  const customerId = new mongoose.Types.ObjectId();
  const otherCustomerId = new mongoose.Types.ObjectId();
  const call = (method, path, body, accessToken = token(customerId)) =>
    fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const home = {
    label: 'Home', name: 'Asha Rao', phone: '+91 98765 43210', line: '221B Baker Street',
    city: 'Ahmedabad', state: 'Gujarat', pincode: '380015', isDefault: false,
  };

  assert.equal((await fetch(`${base}/addresses`)).status, 401);
  const firstResponse = await call('POST', '/addresses', home);
  assert.equal(firstResponse.status, 201);
  const first = (await firstResponse.json()).data;
  assert.equal(first.isDefault, true);

  const secondResponse = await call('POST', '/addresses', {
    ...home, label: 'Work', line: '4th Floor, Tech Park One', pincode: '380054', isDefault: false,
  });
  const second = (await secondResponse.json()).data;
  assert.equal(second.isDefault, false);
  assert.equal((await call('PATCH', `/addresses/${second.id}`, { label: 'Other' })).status, 200);
  assert.equal((await call('POST', '/addresses', { ...home, pincode: '110001' })).status, 409);

  const switched = await Promise.all([
    call('POST', `/addresses/${first.id}/default`),
    call('POST', `/addresses/${second.id}/default`),
  ]);
  assert.ok(switched.every((response) => response.status === 200));
  let list = (await (await call('GET', '/addresses')).json()).data;
  assert.equal(list.items.filter((address) => address.isDefault).length, 1);
  assert.ok([first.id, second.id].includes(list.defaultAddressId));

  assert.equal((await call('GET', '/addresses', null, token(otherCustomerId))).status, 200);
  assert.deepEqual((await (await call('GET', '/addresses', null, token(otherCustomerId))).json()).data.items, []);
  assert.equal((await call('DELETE', `/addresses/${second.id}`, null, token(otherCustomerId))).status, 404);
  assert.equal((await call('DELETE', `/addresses/${second.id}`)).status, 200);
  list = (await (await call('GET', '/addresses')).json()).data;
  assert.deepEqual([list.items.length, list.items[0].isDefault], [1, true]);
});

test('customer privacy: schedules deletion once and anonymizes due accounts', opts, async (t) => {
  const { mkdir, stat, writeFile } = await import('node:fs/promises');
  const { join: joinPath } = await import('node:path');
  const { createApp } = await import('../src/app/app.js');
  const { createSession } = await import('../src/modules/identity/public/index.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { AuthSession } = await import('../src/modules/identity/infrastructure/persistence/session.model.js');
  const { AddressBook } = await import('../src/modules/customer/infrastructure/persistence/addressBook.model.js');
  const { AccountDeletion } = await import('../src/modules/customer/infrastructure/persistence/accountDeletion.model.js');
  const { processDueAccountDeletions } = await import('../src/modules/customer/application/privacy.service.js');
  const { RecentView } = await import('../src/modules/product/infrastructure/persistence/recentView.model.js');
  await Promise.all([User.init(), AuthSession.init(), AddressBook.init(), AccountDeletion.init(), RecentView.init()]);

  const id = new mongoose.Types.ObjectId();
  const avatarKey = `public/avatars/${id}/me.png`;
  await mkdir(joinPath(process.env.UPLOAD_DIR, 'public', 'avatars', String(id)), { recursive: true });
  await writeFile(joinPath(process.env.UPLOAD_DIR, avatarKey), 'png');
  await User.create({ _id: id, role: 'CUSTOMER', name: 'Delete Me', email: `delete-${id}@arise.test`, avatarKey });
  await AddressBook.create({ customerId: id, addresses: [] });
  await RecentView.create({ userId: String(id), productId: new mongoose.Types.ObjectId() });
  const session = await createSession({ userId: id, role: 'CUSTOMER' });

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1/privacy`;
  const call = (method, path, body) => fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${session.accessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const eligibility = await call('GET', '/deletion-eligibility');
  assert.equal(eligibility.status, 200);
  assert.deepEqual((await eligibility.json()).data, { eligible: true, blockers: [], existingRequest: null });
  assert.equal((await call('POST', '/deletion-request', { reasonCode: 'PRIVACY', acknowledged: false })).status, 422);
  const scheduled = await call('POST', '/deletion-request', { reasonCode: 'PRIVACY', acknowledged: true });
  assert.equal(scheduled.status, 202);
  const first = (await scheduled.json()).data.existingRequest;
  const repeated = await call('POST', '/deletion-request', { reasonCode: 'OTHER', acknowledged: true });
  assert.equal((await repeated.json()).data.existingRequest.id, first.id);
  assert.equal(await AccountDeletion.countDocuments({ customerId: id }), 1);

  assert.deepEqual(await processDueAccountDeletions(new Date()), { completed: 0 });
  assert.deepEqual(await processDueAccountDeletions(new Date(Date.now() + 8 * 24 * 60 * 60_000)), { completed: 1 });
  const customer = await User.findById(id).lean();
  assert.deepEqual([customer.status, customer.name, customer.email, customer.avatarKey], ['DEACTIVATED', 'Deleted customer', undefined, undefined]);
  assert.equal(await AddressBook.exists({ customerId: id }), null);
  assert.equal(await RecentView.countDocuments({ userId: String(id) }), 0);
  assert.equal((await AuthSession.findOne({ userId: String(id) }).lean()).revokedReason, 'account_deleted');
  assert.equal((await AccountDeletion.findOne({ customerId: id }).lean()).status, 'COMPLETED');
  await assert.rejects(stat(joinPath(process.env.UPLOAD_DIR, avatarKey)), { code: 'ENOENT' });
});

test('wishlist: saves live products once, reports stock, hides delisted ones and is wiped with the account', opts, async () => {
  const wishlist = await import('../src/modules/wishlist/application/wishlist.service.js');
  const { WishlistItem } = await import('../src/modules/wishlist/infrastructure/persistence/wishlistItem.model.js');
  const { catalogChanged } = await import('../src/infrastructure/realtime/catalogEvents.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init(), WishlistItem.init()]);

  const _id = new mongoose.Types.ObjectId();
  await Category.create({ _id, name: 'Wish Root', nameKey: 'wish root', slug: 'wish-root', parentId: null, rootId: _id, level: 1, sortOrder: 1 });
  const listed = async (title, stock) => {
    const product = await Product.create({
      title, status: 'LIVE', categoryId: _id, rootCategoryId: _id, categoryPath: 'Wish Root', brandName: 'Acme',
      images: ['public/products/s1/w.png'], createdBySellerId: 's1',
    });
    const variant = await Variant.create({ productId: product._id, sku: `WISH-${title}`, label: 'One', weightG: 100, dimsCm: { l: 1, w: 1, h: 1 } });
    await Offer.create({ productId: product._id, variantId: variant._id, sellerId: 's1', sellingPricePaise: 900, mrpPaise: 1200, stock, status: 'LIVE' });
    return String(product._id);
  };
  const lamp = await listed('Wish Lamp', 4);
  const mug = await listed('Wish Mug', 0);
  catalogChanged();

  const customer = String(new mongoose.Types.ObjectId());
  assert.deepEqual(await wishlist.addToWishlist(customer, lamp), { productId: lamp, wishlisted: true });
  await wishlist.addToWishlist(customer, mug);
  await wishlist.addToWishlist(customer, lamp); // saving again keeps one entry
  await assert.rejects(wishlist.addToWishlist(customer, String(new mongoose.Types.ObjectId())), { code: 'PRODUCT_NOT_FOUND' });

  const list = await wishlist.listWishlist(customer);
  assert.deepEqual(list.items.map((item) => [item.name, item.pricePaise, item.available]), [['Wish Mug', 900, false], ['Wish Lamp', 900, true]]); // newest first
  assert.equal(list.total, 2);
  assert.equal((await wishlist.listWishlist(String(new mongoose.Types.ObjectId()))).total, 0); // someone else's is separate

  // a delisted product drops out of the list but is kept, and shows again once it is back
  await Product.updateOne({ _id: mug }, { $set: { status: 'NEEDS_CHANGES' } });
  catalogChanged();
  assert.deepEqual((await wishlist.listWishlist(customer)).items.map((item) => item.name), ['Wish Lamp']);
  assert.equal(await WishlistItem.countDocuments({ customerId: customer }), 2);

  assert.deepEqual(await wishlist.removeFromWishlist(customer, lamp), { productId: lamp, wishlisted: false });
  assert.deepEqual(await wishlist.removeFromWishlist(customer, lamp), { productId: lamp, wishlisted: false }); // already gone is fine
  await wishlist.deleteCustomerWishlist(customer);
  assert.equal(await WishlistItem.countDocuments({ customerId: customer }), 0);
});

test('customer coupons: lists only usable coupons, public ones to anyone and targeted ones to their customer', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { listAvailableCoupons } = await import('../src/modules/coupon/application/customerCoupon.service.js');
  const { Coupon } = await import('../src/modules/coupon/infrastructure/persistence/coupon.model.js');
  await Coupon.init();

  const hour = 3_600_000;
  const now = Date.now();
  const me = new mongoose.Types.ObjectId();
  const base = {
    type: 'FLAT', valuePaise: 5_000, minCartPaise: 19_900, totalLimit: 100, perUserLimit: 1, budgetPaise: 1_000_000,
    startsAt: new Date(now - hour), endsAt: new Date(now + 48 * hour), createdBy: 'admin-1',
  };
  const make = (code, over = {}) => Coupon.create({ ...base, code, name: code, ...over });
  await make('CUSTPUBLIC', { endsAt: new Date(now + 24 * hour) });
  await make('CUSTNEW', { audience: { type: 'NEW' }, description: 'Welcome gift' });
  await make('CUSTMINE', { audience: { type: 'CUSTOM', customerIds: [me] }, visibility: 'HIDDEN' });
  await make('CUSTSELLER', { sellerId: String(new mongoose.Types.ObjectId()), fundedBy: 'SELLER' });
  // none of these can be used right now
  await make('CUSTHIDDEN', { visibility: 'HIDDEN' });
  await make('CUSTOTHER', { audience: { type: 'CUSTOM', customerIds: [new mongoose.Types.ObjectId()] } });
  await make('CUSTDRAFT', { state: 'DRAFT' });
  await make('CUSTPAUSED', { state: 'PAUSED' });
  await make('CUSTSOON', { startsAt: new Date(now + hour) });
  await make('CUSTOVER', { startsAt: new Date(now - 3 * hour), endsAt: new Date(now - hour) });
  await make('CUSTUSEDUP', { totalLimit: 2, totalRedemptions: 2 });
  await make('CUSTBROKE', { budgetUsedPaise: 1_000_000 });

  const codes = async (customerId) => (await listAvailableCoupons(customerId)).items.map((item) => item.code).filter((code) => code.startsWith('CUST'));
  assert.deepEqual(await codes(null), ['CUSTPUBLIC', 'CUSTNEW', 'CUSTSELLER']); // soonest-ending first
  assert.deepEqual((await codes(String(me))).sort(), ['CUSTMINE', 'CUSTNEW', 'CUSTPUBLIC', 'CUSTSELLER']);

  const byCode = new Map((await listAvailableCoupons(String(me))).items.map((item) => [item.code, item]));
  assert.deepEqual(byCode.get('CUSTPUBLIC'), {
    id: byCode.get('CUSTPUBLIC').id, code: 'CUSTPUBLIC', title: 'CUSTPUBLIC', description: 'Flat ₹50 off on orders above ₹199',
    expiresAt: byCode.get('CUSTPUBLIC').expiresAt, eligibilityStatus: 'UNKNOWN',
  });
  assert.equal(byCode.get('CUSTNEW').description, 'Welcome gift · On your first order');
  assert.equal(byCode.get('CUSTSELLER').description, 'Flat ₹50 off on orders above ₹199 · Only on items from one seller');

  // signed out works too, over HTTP
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1/coupons/available`);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).data.items.some((item) => item.code === 'CUSTPUBLIC' && typeof item.expiresAt === 'string'));
});

test('seller stock: lists only own offers, edits self-ship stock once per version, keeps a ledger', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { StockMovement } = await import('../src/modules/product/infrastructure/persistence/stockMovement.model.js');
  await Promise.all([Offer.init(), StockMovement.init()]);

  const sellerA = String(new mongoose.Types.ObjectId());
  const sellerB = String(new mongoose.Types.ObjectId());
  const offer = (sellerId, productTitle, stock, over = {}) => Offer.create({
    productId: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(), sellerId, productTitle, stock,
    sku: `SKU-${productTitle.toUpperCase()}`, sellingPricePaise: 900, mrpPaise: 1200, status: 'LIVE', ...over,
  });
  const mug = await offer(sellerA, 'Mug', 3, { variantLabel: 'Blue' });
  await offer(sellerA, 'Lamp', 40);
  const kettle = await offer(sellerA, 'Kettle', 8, { fulfillmentType: 'ARISE' });
  const other = await offer(sellerB, 'Vase', 5);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const users = new Map([[sellerA, String(new mongoose.Types.ObjectId())], [sellerB, String(new mongoose.Types.ObjectId())]]);
  const tokenOf = (sellerId) => signAccessToken({ sub: users.get(sellerId), role: 'SELLER', sellerId });
  const call = async (path, { method = 'GET', body, sellerId = sellerA, key } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/seller/v1/inventory${path}`, {
      method,
      headers: { authorization: `Bearer ${tokenOf(sellerId)}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  const list = await call('?sort=-sellable');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map((row) => [row.productTitle, row.sellable, row.available, row.lowStock]), [['Lamp', 40, 40, false], ['Kettle', 8, 8, true], ['Mug', 3, 3, true]]);
  assert.deepEqual(list.body.meta.counts, { skus: 3, unitsSellable: 51, lowStock: 2, aged: 0 });
  assert.equal(list.body.meta.total, 3);
  assert.deepEqual((await call('?lowStock=true&fulfillmentType=SELLER')).body.data.map((row) => row.productTitle), ['Mug']);
  assert.deepEqual((await call('?q=mug')).body.data.map((row) => row.sku), ['SKU-MUG']);
  assert.deepEqual((await call('?aged=true')).body.data, []);
  assert.deepEqual((await call('/recommendations')).body.data, []);

  const edit = { sellable: 12, version: 1, note: 'Cycle count' };
  const updated = await call(`/${mug.id}/stock`, { method: 'PATCH', body: edit, key: `inventory-stock:${mug.id}:1:12` });
  assert.equal(updated.status, 200);
  assert.deepEqual([updated.body.data.sellable, updated.body.data.version], [12, 2]);
  const replay = await call(`/${mug.id}/stock`, { method: 'PATCH', body: edit, key: `inventory-stock:${mug.id}:1:12` });
  assert.deepEqual([replay.status, replay.body.data.version], [200, 2]); // same request again changes nothing
  const stale = await call(`/${mug.id}/stock`, { method: 'PATCH', body: { ...edit, sellable: 2 }, key: `inventory-stock:${mug.id}:1:2` });
  assert.deepEqual([stale.status, stale.body.error.code, stale.body.error.details.current.sellable], [409, 'VERSION_CONFLICT', 12]);
  assert.equal((await call(`/${mug.id}/stock`, { method: 'PATCH', body: { ...edit, sellable: -1 }, key: 'inventory-stock-neg' })).status, 422);

  const fba = await call(`/${kettle.id}/stock`, { method: 'PATCH', body: edit, key: `inventory-stock:${kettle.id}:1:12` });
  assert.deepEqual([fba.status, fba.body.error.code], [409, 'FBA_STOCK_IMMUTABLE']);
  assert.equal((await call(`/${other.id}/stock`, { method: 'PATCH', body: edit, key: `inventory-stock:${other.id}:1:12` })).status, 404);
  assert.equal((await Offer.findById(other.id).lean()).stock, 5); // another seller's stock is untouched

  const ledger = await call(`/${mug.id}/ledger`);
  assert.deepEqual(ledger.body.data.entries.map((e) => [e.type, e.qty, e.balanceAfter, e.note]), [['ADJUSTMENT', 9, 12, 'Cycle count']]);
  assert.equal(ledger.body.data.inventory.sellable, 12);
  assert.equal((await call(`/${mug.id}/ledger`, { sellerId: sellerB })).status, 404);
  assert.deepEqual((await call('', { sellerId: sellerB })).body.data.map((row) => row.productTitle), ['Vase']);
});

test('category commission: the bottom-most set rate wins, and changing it needs the finance permission', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  await Promise.all([User.init(), Category.init()]);

  const catalog = ['catalog.category.view', 'catalog.category.create', 'catalog.category.edit'];
  const finance = await User.create({ role: 'ADMIN', email: 'commission-finance@arise.test', status: 'ACTIVE', permissions: [...catalog, 'finance.commission.edit'] });
  const editor = await User.create({ role: 'ADMIN', email: 'commission-editor@arise.test', status: 'ACTIVE', permissions: catalog });
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = async (path, { method = 'GET', body, as = finance } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/v1/categories${path}`, {
      method,
      headers: { authorization: `Bearer ${signAccessToken({ sub: String(as._id), role: 'ADMIN' })}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  const { getCategoryForListing } = await import('../src/modules/category/application/category.service.js');
  const make = async (name, parentId, extra = {}, as = finance) => (await call('/', { method: 'POST', body: { name, ...(parentId ? { parentId } : {}), ...extra }, as })).body.data;
  const inherited = async (categoryId) => (await call(`/${categoryId}`)).body.meta.inheritedCommission;
  const applied = async (categoryId) => (await getCategoryForListing(categoryId)).commissionPct;

  const root = await make('Commission Root', null, { commissionPct: 12.5 });
  const mid = await make('Commission Mid', root.id, {}, editor);
  const leaf = await make('Commission Leaf', mid.id, {}, editor);
  assert.deepEqual([root.commissionPct, mid.commissionPct, leaf.commissionPct], [12.5, null, null]); // a child is not given a copy

  // only the top has a rate: everything below follows it, and says where it comes from
  assert.deepEqual(await inherited(leaf.id), { pct: 12.5, source: { id: root.id, name: 'Commission Root' } });
  assert.equal(await applied(leaf.id), 12.5);

  // a rate in the middle beats the top, and the bottom one beats both
  const midSet = await call(`/${mid.id}`, { method: 'PATCH', body: { commissionPct: 8, version: mid.version } });
  assert.equal(midSet.status, 200);
  assert.deepEqual(await inherited(leaf.id), { pct: 8, source: { id: mid.id, name: 'Commission Mid' } });
  assert.equal(await applied(leaf.id), 8);
  const leafSet = await call(`/${leaf.id}`, { method: 'PATCH', body: { commissionPct: 5.25, version: leaf.version } });
  assert.deepEqual([leafSet.status, leafSet.body.data.commissionPct], [200, 5.25]);
  assert.equal(await applied(leaf.id), 5.25);
  assert.equal((await inherited(leaf.id)).pct, 8); // the hint ignores its own rate

  // clearing it hands the category back to what is above
  const cleared = await call(`/${leaf.id}`, { method: 'PATCH', body: { commissionPct: null, version: leafSet.body.data.version } });
  assert.deepEqual([cleared.status, cleared.body.data.commissionPct], [200, null]);
  assert.equal(await applied(leaf.id), 8);

  // no rate anywhere up the tree counts as 0, from no category
  const lone = await make('Commission Lone', null, {}, editor);
  assert.deepEqual(await inherited(lone.id), { pct: 0, source: null });

  // the permission: inheriting is free, setting or changing a rate needs the finance permission
  assert.equal((await call('/', { method: 'POST', body: { name: 'Commission Set', parentId: root.id, commissionPct: 5 }, as: editor })).status, 403);
  const saved = await call(`/${cleared.body.data.id}`, { method: 'PATCH', body: { name: 'Commission Kid', commissionPct: null, version: cleared.body.data.version }, as: editor });
  assert.deepEqual([saved.status, saved.body.data.name], [200, 'Commission Kid']); // the form re-sends the unchanged (empty) rate
  const denied = await call(`/${leaf.id}`, { method: 'PATCH', body: { commissionPct: 9, version: saved.body.data.version }, as: editor });
  assert.deepEqual([denied.status, denied.body.error.code], [403, 'FORBIDDEN']);
  const deniedClear = await call(`/${mid.id}`, { method: 'PATCH', body: { commissionPct: null, version: midSet.body.data.version }, as: editor });
  assert.equal(deniedClear.status, 403);

  for (const commissionPct of [-1, 41, 2.555]) {
    assert.equal((await call(`/${leaf.id}`, { method: 'PATCH', body: { commissionPct, version: saved.body.data.version } })).status, 422);
  }
  assert.ok((await call(`/${leaf.id}`)).body.meta.allowedActions.includes('EDIT_COMMISSION'));
  assert.ok(!(await call(`/${leaf.id}`, { as: editor })).body.meta.allowedActions.includes('EDIT_COMMISSION'));
});

// Shared by the order-readiness tests below: a category, products and offers owned by given sellers.
async function stockFixture(prefix) {
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  const { catalogChanged } = await import('../src/infrastructure/realtime/catalogEvents.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init(), Seller.init()]);
  const _id = new mongoose.Types.ObjectId();
  await Category.create({ _id, name: `${prefix} Root`, nameKey: `${prefix.toLowerCase()} root`, slug: `${prefix.toLowerCase()}-root`, parentId: null, rootId: _id, level: 1, sortOrder: 1 });
  const seller = async (storeName, over = {}) => String((await Seller.create({ storeName, status: 'APPROVED', ...over }))._id);
  const listed = async (title, sellerId, stock, over = {}) => {
    const product = await Product.create({
      title, status: 'LIVE', categoryId: _id, rootCategoryId: _id, categoryPath: `${prefix} Root`, brandName: 'Acme',
      images: ['public/products/s1/o.png'], createdBySellerId: sellerId,
    });
    const variant = await Variant.create({ productId: product._id, sku: `${prefix}-${title}`.toUpperCase().replaceAll(' ', '-'), label: 'One', weightG: 100, dimsCm: { l: 1, w: 1, h: 1 } });
    const offer = await Offer.create({ productId: product._id, variantId: variant._id, sellerId, sellingPricePaise: 900, mrpPaise: 1200, stock, status: 'LIVE', ...over });
    catalogChanged();
    return { product, offer, productId: String(product._id), offerId: String(offer._id) };
  };
  return { seller, listed, Seller, Offer };
}

test('seller eligibility: suspended, unapproved and on-holiday sellers drop out of the shop, and return with the seller', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { setVacationMode } = await import('../src/modules/identity/application/sellerSettings.service.js');
  const { seller, listed, Seller } = await stockFixture('Elig');
  const [ok, holiday, suspended, pending] = await Promise.all([seller('Elig Ok'), seller('Elig Holiday'), seller('Elig Suspended'), seller('Elig Pending')]);
  const items = { ok: await listed('Elig Mug', ok, 5), holiday: await listed('Elig Lamp', holiday, 5), suspended: await listed('Elig Vase', suspended, 5), pending: await listed('Elig Pot', pending, 5) };
  await Seller.updateOne({ _id: suspended }, { $set: { status: 'SUSPENDED' } });
  await Seller.updateOne({ _id: pending }, { $set: { status: 'UNDER_REVIEW' } });
  await setVacationMode(holiday, true, { userId: 'seller-user' });

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`);
    return { status: response.status, body: await response.json() };
  };
  const shown = async () => (await get('/search?q=Elig')).body.data.items.map((item) => item.name).sort();

  assert.deepEqual(await shown(), ['Elig Mug']);
  assert.equal((await get(`/products/${items.ok.productId}`)).status, 200);
  for (const key of ['holiday', 'suspended', 'pending']) assert.equal((await get(`/products/${items[key].productId}`)).status, 404, key);

  await setVacationMode(holiday, false, { userId: 'seller-user' }); // coming back from holiday restores the listing
  assert.deepEqual(await shown(), ['Elig Lamp', 'Elig Mug']);
  await Seller.updateOne({ _id: suspended }, { $set: { status: 'ACTIVE' } }); // an active seller sells too
  assert.deepEqual(await shown(), ['Elig Lamp', 'Elig Mug', 'Elig Vase']);
});

test('stock reservations: all-or-nothing holds, no oversell under contention, commit, release and expiry', opts, async () => {
  const stock = await import('../src/modules/product/application/stockReservation.service.js');
  const inventory = await import('../src/modules/product/application/inventory.service.js');
  const { StockReservation } = await import('../src/modules/product/infrastructure/persistence/stockReservation.model.js');
  const { StockMovement } = await import('../src/modules/product/infrastructure/persistence/stockMovement.model.js');
  const { getPurchasableOffers } = await import('../src/modules/product/public/index.js');
  await Promise.all([StockReservation.init(), StockMovement.init()]);
  const { seller, listed, Offer } = await stockFixture('Resv');
  const sellerId = await seller('Resv Seller');
  const a = await listed('Resv A', sellerId, 5);
  const b = await listed('Resv B', sellerId, 2);
  const inOneHour = new Date(Date.now() + 3_600_000);
  const state = async (item) => { const o = await Offer.findById(item.offerId).lean(); return [o.stock, o.reserved ?? 0]; };
  const fail = async (work) => work.then(() => assert.fail('expected a conflict'), (error) => error);

  // a checkout with one short line holds nothing at all, and says exactly what was short
  const short = await fail(stock.holdStock({ reference: 'chk-1', lines: [{ offerId: a.offerId, qty: 3 }, { offerId: b.offerId, qty: 3 }], expiresAt: inOneHour }));
  assert.equal(short.code, 'INSUFFICIENT_STOCK');
  assert.deepEqual(short.details.lines, [{ offerId: b.offerId, requested: 3, available: 2, reason: 'INSUFFICIENT_STOCK' }]);
  assert.deepEqual([await state(a), await state(b)], [[5, 0], [2, 0]]);

  const held = await stock.holdStock({ reference: 'chk-1', customerId: 'cust-1', lines: [{ offerId: a.offerId, qty: 3 }, { offerId: b.offerId, qty: 2 }], expiresAt: inOneHour });
  assert.equal(held.length, 2);
  assert.deepEqual([await state(a), await state(b)], [[5, 3], [2, 2]]);
  await stock.holdStock({ reference: 'chk-1', lines: [{ offerId: a.offerId, qty: 3 }, { offerId: b.offerId, qty: 2 }], expiresAt: inOneHour }); // a retry takes nothing twice
  assert.deepEqual(await state(a), [5, 3]);
  assert.equal((await fail(stock.holdStock({ reference: 'chk-1', lines: [{ offerId: a.offerId, qty: 1 }], expiresAt: inOneHour }))).code, 'RESERVATION_EXISTS');

  // others cannot take what is held, and shoppers see only what is left
  const other = await fail(stock.holdStock({ reference: 'chk-2', lines: [{ offerId: a.offerId, qty: 3 }], expiresAt: inOneHour }));
  assert.equal(other.details.lines[0].available, 2);
  assert.equal((await getPurchasableOffers([a.offerId])).get(a.offerId).availableUnits, 2);

  // the seller sees the hold and cannot count stock below it
  const row = (await inventory.listSellerInventory(sellerId, { page: 1, pageSize: 10, sort: '-sellable' })).data.find((r) => r.id === a.offerId);
  assert.deepEqual([row.sellable, row.reserved, row.available], [5, 3, 2]);
  const refused = await fail(inventory.setSellerStock(sellerId, a.offerId, { sellable: 2, version: row.version, note: 'recount' }, { userId: 's' }));
  assert.equal(refused.code, 'RESERVED_STOCK');

  // paying sells the units: stock drops, the hold goes, the ledger records it; repeating changes nothing
  const sold = await stock.commitStock({ reference: 'chk-1' });
  assert.deepEqual([sold.committed.length, sold.missing.length], [2, 0]);
  assert.deepEqual([await state(a), await state(b)], [[2, 0], [0, 0]]);
  assert.deepEqual((await stock.commitStock({ reference: 'chk-1' })).committed.length, 2);
  assert.deepEqual(await state(a), [2, 0]);
  const ledger = await StockMovement.find({ offerId: a.offerId, type: 'SALE' }).lean();
  assert.deepEqual(ledger.map((m) => [m.qty, m.balanceAfter, m.reference]), [[-3, 2, 'chk-1']]);
  assert.equal((await Offer.findById(a.offerId).lean()).version, 2); // a stale stock-page edit now gets VERSION_CONFLICT

  // an abandoned checkout gives its units back, once
  await stock.holdStock({ reference: 'chk-3', lines: [{ offerId: a.offerId, qty: 1 }], expiresAt: inOneHour });
  assert.equal((await stock.releaseStock({ reference: 'chk-3' })).length, 1);
  assert.equal((await stock.releaseStock({ reference: 'chk-3' })).length, 0);
  assert.deepEqual(await state(a), [2, 0]);

  // a hold nobody paid for expires; paying late finds it gone and says so
  await stock.holdStock({ reference: 'chk-4', lines: [{ offerId: a.offerId, qty: 2 }], expiresAt: new Date(Date.now() - 1000) });
  assert.deepEqual(await state(a), [2, 2]);
  assert.equal(await stock.expireStaleReservations(), 1);
  assert.equal(await stock.expireStaleReservations(), 0);
  assert.deepEqual(await state(a), [2, 0]);
  const late = await stock.commitStock({ reference: 'chk-4' });
  assert.deepEqual([late.committed.length, late.missing[0].status], [0, 'EXPIRED']);

  // twelve shoppers race for five units: exactly five win
  const c = await listed('Resv C', sellerId, 5);
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => stock.holdStock({ reference: `race-${i}`, lines: [{ offerId: c.offerId, qty: 1 }], expiresAt: inOneHour })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'INSUFFICIENT_STOCK'));
  assert.deepEqual(await state(c), [5, 5]);
});

test('line resolution: one price and one verdict for cart, checkout and order', opts, async () => {
  const { resolveLines } = await import('../src/modules/cart/public/index.js');
  const { holdStock } = await import('../src/modules/product/public/index.js');
  const { Campaign } = await import('../src/modules/coupon/infrastructure/persistence/campaign.model.js');
  const { CampaignSubmission } = await import('../src/modules/coupon/infrastructure/persistence/campaignSubmission.model.js');
  await Promise.all([Campaign.init(), CampaignSubmission.init()]);
  const { seller, listed, Seller } = await stockFixture('Line');
  const [ok, holiday] = await Promise.all([seller('Line Ok'), seller('Line Holiday', { vacationMode: true })]);
  const mug = await listed('Line Mug', ok, 4);
  const away = await listed('Line Away', holiday, 4);
  const gone = await listed('Line Gone', ok, 0);
  const hour = 3_600_000;
  const campaign = await Campaign.create({ name: 'Line Flash', type: 'FLASH_DEAL', status: 'ACTIVE', customerSection: 'FLASH_DEALS_RAIL', minDiscountPct: 10, startsAt: new Date(Date.now() - hour), endsAt: new Date(Date.now() + hour), createdBy: 'admin' });
  await CampaignSubmission.create({ campaignId: campaign._id, sellerId: ok, sellerName: 'Line Ok', productId: mug.productId, productTitle: 'Line Mug', mrpPaise: 1200, dealPricePaise: 700, discountPct: 42, stockCommitted: 3, status: 'APPROVED' });
  const one = async (offerId, quantity) => (await resolveLines([{ offerId, quantity }]))[0];

  // price: a running campaign beats the shelf while enough deal units remain for the whole quantity
  const deal = await one(mug.offerId, 2);
  assert.deepEqual([deal.unitPricePaise, deal.priceSource, deal.campaign.name, deal.sellable, deal.issueCode], [700, 'CAMPAIGN', 'Line Flash', true, null]);
  assert.deepEqual([deal.mrpPaise, deal.sellerName, deal.variantLabel, deal.maximumQuantity], [1200, 'Line Ok', 'One', 4]);
  const past = await one(mug.offerId, 4); // only 3 deal units left: the whole line is at the shelf price
  assert.deepEqual([past.unitPricePaise, past.priceSource, past.campaign, past.sellable], [900, 'SHELF', null, true]);
  await Campaign.updateOne({ _id: campaign._id }, { $set: { status: 'PAUSED' } });
  const paused = await one(mug.offerId, 2);
  assert.deepEqual([paused.unitPricePaise, paused.priceSource], [900, 'SHELF']);

  // verdicts
  const tooMany = await one(mug.offerId, 5);
  assert.deepEqual([tooMany.issueCode, tooMany.sellable], ['QUANTITY_LIMIT', false]);
  assert.equal((await one(away.offerId, 1)).issueCode, 'SELLER_UNAVAILABLE');
  assert.equal((await one(gone.offerId, 1)).issueCode, 'OUT_OF_STOCK');
  const missing = await one(String(new mongoose.Types.ObjectId()), 1);
  assert.deepEqual([missing.sellable, missing.issueCode], [false, 'OFFER_UNAVAILABLE']);

  // units held by another checkout are not available to this one
  await holdStock({ reference: 'line-hold', lines: [{ offerId: mug.offerId, qty: 3 }], expiresAt: new Date(Date.now() + hour) });
  const left = await one(mug.offerId, 2);
  assert.deepEqual([left.availableUnits, left.maximumQuantity, left.issueCode], [1, 1, 'QUANTITY_LIMIT']);

  // answers come back in the order asked, and the seller returning from holiday sells again
  await Seller.updateOne({ _id: holiday }, { $set: { vacationMode: false } });
  const both = await resolveLines([{ offerId: away.offerId, quantity: 1 }, { offerId: mug.offerId, quantity: 1 }]);
  assert.deepEqual(both.map((l) => [l.name, l.sellable]), [['Line Away', true], ['Line Mug', true]]);
});

test('cart: priced by the server on every read, checked on every change, coupon-aware, one per customer', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { Coupon } = await import('../src/modules/coupon/infrastructure/persistence/coupon.model.js');
  const { Cart } = await import('../src/modules/cart/infrastructure/persistence/cart.model.js');
  await Promise.all([Coupon.init(), Cart.init()]);
  const { seller, listed, Seller, Offer } = await stockFixture('Cart');
  const home = await seller('Cart Seller');
  const away = await seller('Cart Away');
  const mug = await listed('Cart Mug', home, 6, { sellingPricePaise: 30_000, mrpPaise: 40_000 });
  const lamp = await listed('Cart Lamp', home, 50, { sellingPricePaise: 2_000, mrpPaise: 2_500 });
  const scarf = await listed('Cart Scarf', away, 5, { sellingPricePaise: 1_000, mrpPaise: 1_200 });
  const variantOf = (item) => String(item.offer.variantId);
  const day = 86_400_000;
  const coupon = (code, over) => Coupon.create({ code, name: code, type: 'FLAT', valuePaise: 5_000, minCartPaise: 19_900, totalLimit: 100, perUserLimit: 1, budgetPaise: 1_000_000, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day), createdBy: 'admin', ...over });
  await coupon('CART50', {});
  await coupon('CARTBIG', { minCartPaise: 1_000_000 });
  await coupon('CARTHIDE', { valuePaise: 1_000, minCartPaise: 0, visibility: 'HIDDEN' });

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const alice = String(new mongoose.Types.ObjectId());
  const bob = String(new mongoose.Types.ObjectId());
  const call = async (method, path, { body, as = alice, anonymous = false } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(anonymous ? {} : { authorization: `Bearer ${signAccessToken({ sub: as, role: 'CUSTOMER' })}` }) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const cart = async (as = alice) => (await call('GET', '/cart', { as })).body.data;
  const error = (response) => [response.status, response.body.error.code];

  // nothing yet: an empty cart owes nothing, and it needs a signed-in customer
  assert.equal((await call('GET', '/cart', { anonymous: true })).status, 401);
  const empty = await cart();
  assert.deepEqual([empty.id, empty.version, empty.items, empty.savedItems, empty.checkoutAllowed, empty.totals.payablePaise], [alice, 0, [], [], false, 0]);

  // adding by product and variant picks the seller; the line is priced by the server
  const added = await call('POST', '/cart/items', { body: { productId: mug.productId, variantId: variantOf(mug), quantity: 1 } });
  assert.equal(added.status, 201);
  const [line] = added.body.data.items;
  assert.deepEqual([line.pricePaise, line.mrpPaise, line.quantity, line.sellerName, line.variantLabel, line.maximumQuantity, line.available, line.issueCode], [30_000, 40_000, 1, 'Cart Seller', 'One', 6, true, null]);
  assert.deepEqual(added.body.data.totals, { mrpPaise: 40_000, subtotalPaise: 30_000, productDiscountPaise: 10_000, couponDiscountPaise: 0, deliveryFeePaise: 4_000, platformFeePaise: 500, payablePaise: 34_500 });
  assert.deepEqual([added.body.data.version, added.body.data.checkoutAllowed], [1, true]);

  // the same offer again joins the line; going over what can be bought is refused and changes nothing
  assert.equal((await call('POST', '/cart/items', { body: { offerId: mug.offerId, quantity: 2 } })).body.data.items[0].quantity, 3);
  const tooMany = await call('POST', '/cart/items', { body: { offerId: mug.offerId, quantity: 4 } });
  assert.deepEqual(error(tooMany), [409, 'QUANTITY_UNAVAILABLE']);
  assert.equal(tooMany.body.error.details.maximumQuantity, 6);
  const same = await cart();
  assert.deepEqual([same.version, same.items[0].quantity], [2, 3]);

  // bad requests
  assert.deepEqual(error(await call('POST', '/cart/items', { body: { productId: String(new mongoose.Types.ObjectId()), quantity: 1 } })), [404, 'PRODUCT_NOT_FOUND']);
  for (const body of [{}, { productId: mug.productId, quantity: 0 }, { variantId: variantOf(mug), quantity: 1 }, { productId: mug.productId, quantity: 1, price: 1 }, { productId: mug.productId, quantity: 1.5 }]) {
    assert.equal((await call('POST', '/cart/items', { body })).status, 422, JSON.stringify(body));
  }

  // quantity changes: re-priced, delivery turns free from the threshold, limits enforced
  const mugLine = line.cartItemId;
  const two = await call('PATCH', `/cart/items/${mugLine}`, { body: { quantity: 2 } });
  assert.deepEqual([two.body.data.totals.subtotalPaise, two.body.data.totals.deliveryFeePaise, two.body.data.totals.payablePaise], [60_000, 0, 60_500]);
  assert.deepEqual(error(await call('PATCH', `/cart/items/${mugLine}`, { body: { quantity: 7 } })), [409, 'QUANTITY_UNAVAILABLE']);
  assert.deepEqual(error(await call('PATCH', `/cart/items/${new mongoose.Types.ObjectId()}`, { body: { quantity: 1 } })), [404, 'CART_ITEM_NOT_FOUND']);

  // coupons: only ones that would save something are offered; an unlisted code still works by code
  const lampAdded = await call('POST', '/cart/items', { body: { offerId: lamp.offerId, quantity: 1 } });
  const lampLine = lampAdded.body.data.items[1].cartItemId;
  assert.equal(lampAdded.body.data.totals.subtotalPaise, 62_000);
  assert.deepEqual((await call('GET', '/coupons/eligible')).body.data.items.filter((c) => c.code.startsWith('CART')), [{ code: 'CART50', description: 'Flat ₹50 off on orders above ₹199', discountPaise: 5_000, minimumSubtotalPaise: 19_900 }]);
  assert.deepEqual(error(await call('POST', '/cart/coupon', { body: { code: 'NOPE' } })), [422, 'COUPON_INVALID']);
  assert.deepEqual(error(await call('POST', '/cart/coupon', { body: { code: 'cartbig' } })), [409, 'COUPON_MINIMUM_NOT_MET']);
  assert.equal((await cart()).appliedCoupon, null); // a refused coupon is not kept
  const hidden = await call('POST', '/cart/coupon', { body: { code: 'CARTHIDE' } });
  assert.deepEqual([hidden.body.data.appliedCoupon.code, hidden.body.data.totals.couponDiscountPaise], ['CARTHIDE', 1_000]);
  const applied = await call('PUT', '/cart/coupon', { body: { code: ' cart50 ' } }); // PUT is the contract's verb, POST the app's
  assert.deepEqual([applied.body.data.appliedCoupon.code, applied.body.data.appliedCoupon.discountPaise, applied.body.data.totals.payablePaise], ['CART50', 5_000, 57_500]);

  // a change that breaks the coupon drops it and says so
  const smaller = await call('DELETE', `/cart/items/${mugLine}`);
  assert.equal(smaller.body.data.appliedCoupon, null);
  assert.deepEqual(smaller.body.data.issues.map((i) => [i.code, i.blocking]), [['COUPON_REMOVED', false]]);
  assert.deepEqual((await cart()).issues, []);
  assert.deepEqual(error(await call('POST', '/cart/coupon', { body: { code: 'CART50' } })), [409, 'COUPON_MINIMUM_NOT_MET']);
  assert.equal((await call('DELETE', '/cart/coupon')).status, 200);

  // save for later and back; saved items are not charged for
  const mugAgain = await call('POST', '/cart/items', { body: { offerId: mug.offerId, quantity: 1 } });
  const mugId = mugAgain.body.data.items[1].cartItemId;
  const saved = await call('POST', `/cart/items/${mugId}/save-for-later`);
  assert.deepEqual([saved.body.data.items.length, saved.body.data.savedItems.map((i) => i.productId), saved.body.data.totals.payablePaise], [1, [mug.productId], 6_500]);
  assert.deepEqual(error(await call('POST', `/cart/items/${mugId}/save-for-later`)), [404, 'CART_ITEM_NOT_FOUND']);
  assert.deepEqual(error(await call('POST', `/cart/saved/${new mongoose.Types.ObjectId()}/move-to-cart`)), [404, 'SAVED_ITEM_NOT_FOUND']);
  const back = await call('POST', `/cart/saved/${mugId}/move-to-cart`);
  assert.deepEqual([back.body.data.items.length, back.body.data.savedItems.length], [2, 0]);

  // an item that can no longer be bought blocks checkout and is not charged; fixing the cart clears it
  const scarfId = (await call('POST', '/cart/items', { body: { offerId: scarf.offerId, quantity: 1 } })).body.data.items[2].cartItemId;
  await Seller.updateOne({ _id: away }, { $set: { vacationMode: true } });
  const blocked = await cart();
  const scarfLine = blocked.items.find((i) => i.cartItemId === scarfId);
  assert.deepEqual([scarfLine.available, scarfLine.issueCode, blocked.checkoutAllowed, blocked.totals.subtotalPaise], [false, 'SELLER_UNAVAILABLE', false, 32_000]);
  assert.deepEqual(blocked.issues.map((i) => [i.code, i.cartItemId, i.blocking]), [['SELLER_UNAVAILABLE', scarfId, true]]);
  assert.deepEqual(error(await call('PATCH', `/cart/items/${scarfId}`, { body: { quantity: 2 } })), [409, 'PRODUCT_UNAVAILABLE']);
  assert.equal((await call('DELETE', `/cart/items/${scarfId}`)).body.data.checkoutAllowed, true);
  await Offer.updateOne({ _id: lamp.offerId }, { $set: { stock: 0 } });
  assert.deepEqual((await cart()).issues.map((i) => i.code), ['OUT_OF_STOCK']);
  await Offer.updateOne({ _id: lamp.offerId }, { $set: { stock: 50 } });

  // a price change is shown once, on the next look after the next action
  await Offer.updateOne({ _id: lamp.offerId }, { $set: { sellingPricePaise: 2_500, mrpPaise: 3_000 } });
  const changed = await cart();
  assert.deepEqual(changed.issues.map((i) => [i.code, i.cartItemId, i.blocking]), [['PRICE_CHANGED', lampLine, false]]);
  assert.equal(changed.items[0].pricePaise, 2_500);
  assert.equal(changed.checkoutAllowed, true);
  assert.equal((await call('PATCH', `/cart/items/${lampLine}`, { body: { quantity: 1 } })).body.data.issues.length, 1); // judged against what they last saw
  assert.deepEqual((await cart()).issues, []); // ...and now they have seen it

  // every customer has their own cart
  assert.deepEqual((await cart(bob)).items, []);
  assert.deepEqual(error(await call('PATCH', `/cart/items/${lampLine}`, { body: { quantity: 2 }, as: bob })), [404, 'CART_ITEM_NOT_FOUND']);

  // changes made at the same moment from two devices are never lost
  const before = (await cart()).items.find((i) => i.cartItemId === lampLine).quantity;
  const burst = await Promise.all(Array.from({ length: 3 }, () => call('POST', '/cart/items', { body: { offerId: lamp.offerId, quantity: 1 } })));
  const won = burst.filter((r) => r.status === 201).length;
  assert.ok(burst.every((r) => [201, 409].includes(r.status)) && won >= 1);
  assert.equal((await cart()).items.find((i) => i.cartItemId === lampLine).quantity, before + won);
  assert.equal(await Cart.countDocuments({ customerId: alice }), 1);
});

test('wishlist to cart: the cheapest seller\'s offer moves over; what cannot be bought stays saved', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const wishlist = await import('../src/modules/wishlist/application/wishlist.service.js');
  const { deleteCustomerCart } = await import('../src/modules/cart/public/index.js');
  const { Cart } = await import('../src/modules/cart/infrastructure/persistence/cart.model.js');
  const { seller, listed } = await stockFixture('Move');
  const cheap = await seller('Move Cheap');
  const dear = await seller('Move Dear');
  const kettle = await listed('Move Kettle', dear, 5, { sellingPricePaise: 5_000 });
  // a second seller offers the same variant for less: that is the one the cart should take
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const cheaper = await Offer.create({ productId: kettle.product._id, variantId: kettle.offer.variantId, sellerId: cheap, sellingPricePaise: 4_000, mrpPaise: 6_000, stock: 5, status: 'LIVE' });
  const empty = await listed('Move Empty', dear, 0);

  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const customer = String(new mongoose.Types.ObjectId());
  const call = async (method, path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`, {
      method, headers: { authorization: `Bearer ${signAccessToken({ sub: customer, role: 'CUSTOMER' })}` },
    });
    return { status: response.status, body: await response.json() };
  };

  await wishlist.addToWishlist(customer, kettle.productId);
  const moved = await call('POST', `/wishlist/${kettle.productId}/move-to-cart`);
  assert.equal(moved.status, 200);
  assert.deepEqual([moved.body.data.productId, moved.body.data.wishlisted], [kettle.productId, false]);
  const cart = (await call('GET', '/cart')).body.data;
  assert.deepEqual(cart.items.map((i) => [i.cartItemId, i.offerId, i.sellerName, i.pricePaise]), [[moved.body.data.cartItemId, String(cheaper._id), 'Move Cheap', 4_000]]);
  assert.equal((await wishlist.listWishlist(customer)).total, 0);
  assert.deepEqual([(await call('POST', `/wishlist/${kettle.productId}/move-to-cart`)).status, (await call('POST', `/wishlist/${kettle.productId}/move-to-cart`)).body.error.code], [404, 'WISHLIST_ITEM_NOT_FOUND']);

  // out of stock: the cart says why and the item stays on the wishlist
  await wishlist.addToWishlist(customer, empty.productId);
  const refused = await call('POST', `/wishlist/${empty.productId}/move-to-cart`);
  assert.deepEqual([refused.status, refused.body.error.code], [409, 'PRODUCT_OUT_OF_STOCK']);
  assert.equal((await wishlist.listWishlist(customer)).total, 1);
  assert.equal((await call('GET', '/cart')).body.data.items.length, 1);

  // deleting the account deletes the cart
  await deleteCustomerCart(customer);
  assert.equal(await Cart.countDocuments({ customerId: customer }), 0);
});
