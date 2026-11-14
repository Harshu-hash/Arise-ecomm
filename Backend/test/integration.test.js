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
  await User.init();
  await seedRoles();

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

  const roles = await fetch(`${base}/api/admin/v1/admin-users/roles`, { headers: authHeader(superAdmin) });
  assert.equal(roles.status, 200);
  const roleList = (await roles.json()).data;
  assert.equal(roleList.length, 15);
  const superAdminRole = roleList.find((r) => r.key === 'super_admin');

  // Operations Manager has no admin.role.view / admin.user.invite — both gated endpoints refuse it.
  assert.equal((await fetch(`${base}/api/admin/v1/admin-users/roles`, { headers: authHeader(opsManager) })).status, 403);
  const deniedInvite = await fetch(`${base}/api/admin/v1/admin-users/invite`, {
    method: 'POST', headers: { ...authHeader(opsManager), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'X', email: 'x@arise.test', roleIds: [superAdminRole.id] }),
  });
  assert.equal(deniedInvite.status, 403);

  // Super Admin can invite; the new admin's permissions are the union of the assigned roles.
  const invite = await fetch(`${base}/api/admin/v1/admin-users/invite`, {
    method: 'POST', headers: { ...authHeader(superAdmin), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Priya', email: 'priya@arise.test', roleIds: [superAdminRole.id] }),
  });
  assert.equal(invite.status, 201);
  const created = await User.findOne({ email: 'priya@arise.test' }).lean();
  assert.deepEqual(created.permissions, ['*']);
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
