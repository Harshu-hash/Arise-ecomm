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
});

