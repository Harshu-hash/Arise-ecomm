import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DISABLE_INFRASTRUCTURE = 'true';

test('application exports an Express app with the expected namespaces', async () => {
  const { createApp } = await import('../src/app/app.js');
  const app = createApp();
  assert.equal(typeof app, 'function');
  assert.equal(app.get('trust proxy'), 1);
});

test('liveness and customer health endpoints use the contract envelope and one request ID', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const headers = { 'x-request-id': 'test-correlation-id' };
  const liveResponse = await fetch(`http://127.0.0.1:${address.port}/health/live`, { headers });
  const live = await liveResponse.json();
  assert.equal(liveResponse.status, 200);
  assert.equal(liveResponse.headers.get('x-request-id'), 'test-correlation-id');
  assert.equal(live.data.status, 'ok');

  const customerResponse = await fetch(`http://127.0.0.1:${address.port}/api/customer/v1/health`);
  const customer = await customerResponse.json();
  assert.equal(customerResponse.status, 200);
  assert.equal(customer.data.service, 'arise-commerce-backend');

  const configResponse = await fetch(`http://127.0.0.1:${address.port}/api/customer/v1/app-config`);
  const config = (await configResponse.json()).data;
  assert.equal(configResponse.status, 200);
  assert.equal(config.minimumSupportedVersion, '1.0.0');
  assert.equal(config.maintenance.enabled, false);

  const homeResponse = await fetch(`http://127.0.0.1:${address.port}/api/customer/v1/home`);
  const home = (await homeResponse.json()).data;
  assert.equal(homeResponse.status, 200);
  assert.deepEqual(home.sections, []);
  assert.deepEqual(home.header.searchPlaceholders, ['Search products']);
});

test('customer authentication contract is mounted', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/customer/v1/auth`;
  const request = (path, body) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  for (const [path, body] of [
    ['/start', { identifier: 'bad', purpose: 'LOGIN' }],
    ['/verify-otp', { challengeId: 'bad', otp: '1234' }],
    ['/resend-otp', { challengeId: 'bad' }],
    ['/signup', { challengeId: 'bad', otp: '1234' }],
    ['/password/verify-otp', { challengeId: 'bad', otp: '1234' }],
    ['/password/reset', { resetToken: '', password: 'Password1' }],
  ]) assert.equal((await request(path, body)).status, 422, path);

  assert.equal((await request('/refresh', {})).status, 401);
  assert.equal((await request('/logout', {})).status, 200);
  assert.equal((await request('/logout-all', {})).status, 401);
  assert.equal((await fetch(`${base}/session`)).status, 401);
});

