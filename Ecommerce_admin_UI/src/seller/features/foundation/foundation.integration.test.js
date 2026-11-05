import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { exportJobsApi, mediaApi, savedViewsApi } from '@core/api/foundationApi';
import { useSessionStore } from '@core/auth/sessionStore';
import { db } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { listingsApi } from '@seller/features/listings/api/listings.api';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';

const server = setupServer(...sellerHandlers);

describe('S9 seller foundation contracts', () => {
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(() => { seedAll(); seedSellerAccounts(); resetSettings(); updateSettings({ latencyMs: 0 }); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('presigns, uploads, completes and resolves a durable media resource', async () => {
    const user = await signInSeller();
    const file = new File(['image bytes'], 'front.webp', { type: 'image/webp' });
    const presigned = await mediaApi.presign({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, kind: 'PRODUCT_IMAGE' });
    await mediaApi.upload(presigned.uploadUrl, file);
    const processing = await mediaApi.complete(presigned.uploadId, { width: 1200, height: 1200 });
    expect(processing.status).toBe('PROCESSING');
    updateSettings({ clockOffsetMs: 1000 });
    const ready = await mediaApi.get(presigned.mediaId);
    expect(ready).toMatchObject({ id: presigned.mediaId, sellerId: user.sellerId, status: 'READY', width: 1200, height: 1200 });
    expect(ready.previewUrl).not.toMatch(/^(blob:|data:)/);
  });

  it('rejects local blob URLs as listing business data', async () => {
    await signInSeller();
    const category = db.categories.find((row) => row.level === 3);
    await expect(listingsApi.create({ title: 'Unsafe image', categoryId: category.id, mrpPaise: 10000, sellingPricePaise: 9000, images: ['blob:http://localhost/leak'] })).rejects.toMatchObject({ code: 'MEDIA_NOT_DURABLE' });
  });

  it('keeps an export job available after the launching screen is gone', async () => {
    await signInSeller();
    const created = await exportJobsApi.create({ resource: 'orders', format: 'CSV', selection: { mode: 'FILTERED', filters: { status: 'NEW' } }, estimatedRows: 42 });
    expect(created.status).toBe('PROCESSING');
    updateSettings({ clockOffsetMs: 2000 });
    const afterReturn = await exportJobsApi.list();
    const completed = afterReturn.find((job) => job.id === created.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultUrl).toContain('orders');
    expect(completed.metadata.selection.mode).toBe('FILTERED');
  });

  it('replays an idempotent export command without creating a duplicate job', async () => {
    await signInSeller();
    const payload = { resource: 'orders', idempotencyKey: 'orders-export-intent-1' };
    const first = await exportJobsApi.create(payload);
    const replay = await exportJobsApi.create(payload);
    expect(replay.id).toBe(first.id);
    expect(db.jobs.filter((row) => row.id === first.id)).toHaveLength(1);
  });

  it('persists and reapplies server-backed table views', async () => {
    await signInSeller();
    const created = await savedViewsApi.create({ tableId: 'orders', name: 'Overdue', state: { filters: { overdue: 'true' }, sort: '-placedAt' } });
    const views = await savedViewsApi.list('orders');
    expect(views).toContainEqual(expect.objectContaining({ id: created.id, name: 'Overdue', state: { filters: { overdue: 'true' }, sort: '-placedAt' } }));
  });

  it('does not expose one seller’s media or jobs to another seller', async () => {
    await signInSeller();
    const media = await mediaApi.presign({ fileName: 'secret.pdf', mimeType: 'application/pdf', sizeBytes: 10, kind: 'DOCUMENT' });
    const job = await exportJobsApi.create({ resource: 'transactions' });
    useSessionStore.getState().setAnonymous();
    await signInSeller('orders@arise.test');
    await expect(mediaApi.get(media.mediaId)).rejects.toMatchObject({ status: 404 });
    const jobs = await exportJobsApi.list();
    expect(jobs.some((row) => row.id === job.id)).toBe(false);
  });
});
