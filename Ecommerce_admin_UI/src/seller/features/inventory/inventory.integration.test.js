import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { inventoryApi } from './api/inventory.api';

const server = setupServer(...sellerHandlers);

describe('stock management contracts', () => {
  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(() => { seedAll(); seedSellerAccounts(); resetSettings(); updateSettings({ latencyMs: 0 }); });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('updates self-ship stock and records the movement without touching another seller', async () => {
    const user = await signInSeller();
    const response = await inventoryApi.list({ pageSize: 200 });
    const row = response.data.find((item) => item.fulfillmentType === 'SELLER');
    expect(response.data.every((item) => item.sellerId === user.sellerId)).toBe(true);
    const beforeOtherSeller = db.inventory.find((item) => item.sellerId !== user.sellerId)?.sellable;
    const updated = await inventoryApi.updateStock(row.id, { sellable: row.sellable + 5, version: row.version, note: 'Cycle count' });
    expect(updated.sellable).toBe(row.sellable + 5);
    expect(db.inventoryLedger.some((entry) => entry.inventoryId === row.id && entry.qty === 5)).toBe(true);
    expect(db.inventory.find((item) => item.sellerId !== user.sellerId)?.sellable).toBe(beforeOtherSeller);
  });
});
