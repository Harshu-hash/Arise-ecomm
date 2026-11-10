// Real-MongoDB tests. Opt-in: set TEST_MONGODB_URI (a throwaway database; it is dropped afterwards).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import test, { after, before } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
});

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
