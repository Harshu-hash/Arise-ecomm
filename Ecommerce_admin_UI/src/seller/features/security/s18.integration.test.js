import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { exportJobsApi } from '@core/api/foundationApi';
import { useSessionStore } from '@core/auth/sessionStore';
import { db } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { securityApi } from './api/security.api';

const server = setupServer(...sellerHandlers);

describe('S18 team security, credentials and resilience', () => {
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => { seedAll(); seedSellerAccounts(); resetSettings(); updateSettings({ latencyMs: 0 }); await signInSeller(); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('prevents a least-privilege custom-role user from reading credentials or creating exports', async () => {
    const createStep = await securityApi.reauth('Arise@123456');
    const role = await securityApi.createRole({ name: 'Dashboard observer', permissions: ['dashboard.dashboard.view'] }, createStep.token);
    const catalogUser = db.sellerUsers.find((row) => row.email === 'catalog@arise.test');
    const assignStep = await securityApi.reauth('Arise@123456');
    await securityApi.updateUser(catalogUser.id, { roleKey: role.id, status: 'ACTIVE' }, assignStep.token);
    useSessionStore.getState().setAnonymous(); await signInSeller('catalog@arise.test');
    await expect(securityApi.apiKeys()).rejects.toMatchObject({ status: 403 });
    await expect(exportJobsApi.create({ resource: 'orders', idempotencyKey: 'restricted-export' })).rejects.toMatchObject({ status: 403 });
  });

  it('requires step-up for recovery changes and retains the action in seller audit', async () => {
    await expect(securityApi.regenerateBackupCodes('invalid')).rejects.toMatchObject({ status: 403 });
    const step = await securityApi.reauth('Arise@123456');
    const result = await securityApi.regenerateBackupCodes(step.token);
    expect(result.codes).toHaveLength(8);
    expect((await securityApi.overview()).backupCodesRemaining).toBe(8);
    expect((await securityApi.audit()).some((event) => event.action === 'security.backup_codes.regenerate')).toBe(true);
  });

  it('shows an API key secret once, rotates it and revokes the credential without persisting plaintext', async () => {
    const firstStep = await securityApi.reauth('Arise@123456');
    const created = await securityApi.createApiKey({ name: 'Warehouse reader', scopes: ['inventory.stock.view'] }, firstStep.token);
    expect(created.secret).toMatch(/^ars_live_/);
    const listed = (await securityApi.apiKeys()).find((row) => row.id === created.id);
    expect(listed.secret).toBeUndefined(); expect(listed.secretHash).toBeUndefined();
    const rotateStep = await securityApi.reauth('Arise@123456');
    const rotated = await securityApi.apiKeyAction(created.id, 'rotate', rotateStep.token);
    expect(rotated.secret).not.toBe(created.secret);
    const revokeStep = await securityApi.reauth('Arise@123456');
    expect(await securityApi.apiKeyAction(created.id, 'revoke', revokeStep.token)).toMatchObject({ status: 'REVOKED' });
  });

  it('keeps mandatory security notifications enabled and retries a failed webhook delivery safely', async () => {
    const policy = await securityApi.updateNotificationPolicy({ matrix: { security: { inPanel: false, email: false, sms: false } }, quietHours: { enabled: true, from: '22:00', to: '07:00', timezone: 'Asia/Kolkata' }, escalationContacts: ['ops@example.com'] });
    expect(policy.matrix.security).toMatchObject({ inPanel: true, email: true, sms: false });
    const webhook = await securityApi.createWebhook({ url: 'https://erp.example.com/arise/events', events: ['order.created'] });
    expect(webhook.secret).toMatch(/^whsec_/);
    const listed = (await securityApi.webhooks()).find((row) => row.id === webhook.id);
    expect(listed.secret).toBeUndefined(); expect(listed.deliveries[0].status).toBe('FAILED');
    expect(await securityApi.retryDelivery(listed.deliveries[0].id)).toMatchObject({ status: 'DELIVERED', responseStatus: 200 });
  });

  it('retries an interrupted export with the same intent without creating duplicate commands', async () => {
    server.use(http.post('*/api/seller/v1/exports', () => HttpResponse.error(), { once: true }));
    const payload = { resource: 'orders', idempotencyKey: 's18-network-retry', estimatedRows: 25 };
    await expect(exportJobsApi.create(payload)).rejects.toBeTruthy();
    const created = await exportJobsApi.create(payload);
    const replay = await exportJobsApi.create(payload);
    expect(replay.id).toBe(created.id);
    expect(db.jobs.filter((row) => row.id === created.id)).toHaveLength(1);
  });
});
