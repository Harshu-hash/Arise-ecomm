import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';

const server = setupServer(...handlers);
const BASE = `${window.location.origin}/api/admin/v1`;

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() };
}

describe('push broadcasts', () => {
  let token;
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(async () => {
    seedAll();
    const login = await call('/auth/login', { method: 'POST', body: { email: 'super@arise.test', password: DEMO_PASSWORD } });
    token = login.json.data.accessToken;
  });
  afterAll(() => server.close());

  it('validates and records a targeted push broadcast', async () => {
    const response = await call('/push-broadcasts', {
      method: 'POST',
      token,
      body: { title: 'Sale is live', message: 'Open Arise to shop now.', campaignName: 'Sale launch', audiences: ['CUSTOMERS', 'SELLERS'], platforms: ['ANDROID', 'WEB'], estimatedRecipients: 1200 },
    });
    expect(response.status).toBe(201);
    expect(response.json.data.status).toBe('SENT');
    expect(db.pushBroadcasts).toHaveLength(1);
  });
});
