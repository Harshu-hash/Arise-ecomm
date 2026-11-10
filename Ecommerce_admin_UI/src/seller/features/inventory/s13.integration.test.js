import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, find } from '@mocks/db/store';
import { handlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { settingsApi } from '../settings/api/settings.api';
import { inventoryApi } from './api/inventory.api';

const server = setupServer(...handlers, ...sellerHandlers);
const ADMIN_BASE = `${window.location.origin}/api/admin/v1`;

async function adminCall(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${ADMIN_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signInAdmin() {
  const login = await adminCall('/auth/login', { method: 'POST', body: { email: 'super@arise.test', password: DEMO_PASSWORD } });
  const { challengeId, devHint, stage } = login.json.data;
  const verified = await adminCall(`/auth/2fa/${stage === 'enrol_2fa' ? 'enrol' : 'verify'}`, { method: 'POST', body: { challengeId, code: devHint.code } });
  return verified.json.data.accessToken;
}

describe('S13 seller warehouse and inventory lifecycle', () => {
  let sellerId;

  beforeAll(() => { setApiBaseUrl('/api/seller/v1'); server.listen({ onUnhandledRequest: 'error' }); });
  beforeEach(async () => {
    seedAll();
    seedSellerAccounts();
    sellerId = find('sellerUsers', (row) => row.email === 'owner@arise.test').sellerId;
    await signInSeller();
  });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('updates customer availability without allowing reserved stock to be oversold', async () => {
    const list = await api.get('/inventory', { pageSize: 500, fulfillmentType: 'SELLER' });
    const row = list.data.find((item) => item.fulfillmentType === 'SELLER');
    expect(row).toBeTruthy();
    const stored = db.inventory.find((item) => item.id === row.id);
    stored.reserved = Math.min(2, stored.sellable);
    if (stored.sellable < 2) stored.sellable = 2;
    await expect(inventoryApi.updateStock(row.id, { sellable: stored.reserved - 1, version: stored.version })).rejects.toMatchObject({ code: 'RESERVED_STOCK' });
    const updated = await inventoryApi.updateStock(row.id, { sellable: stored.reserved + 7, version: stored.version });
    expect(updated.available).toBe(7);
    expect(db.offers.find((offer) => offer.id === stored.offerId).stock).toBe(updated.sellable);
    expect(db.inventoryLedger.some((entry) => entry.inventoryId === row.id && entry.type === 'ADJUSTMENT')).toBe(true);
  });

  it('receives FBA stock with a discrepancy and exposes ledger plus seller dispute', async () => {
    const warehouse = db.warehouses.find((row) => row.type === 'FULFILMENT' && row.status !== 'CLOSED');
    const variantId = find('offers', (row) => row.sellerId === sellerId).variantId;
    const inbound = await inventoryApi.createInbound({ warehouseId: warehouse.id, packagingType: 'CARTON', boxCount: 1, lines: [{ variantId, qty: 10 }] });
    await inventoryApi.submitInbound(inbound.id);
    const token = await signInAdmin();
    await adminCall(`/inbound/${inbound.id}/transition`, { method: 'POST', token, body: { status: 'APPOINTMENT_BOOKED', appointmentAt: '2026-11-10T10:00:00.000Z' } });
    await adminCall(`/inbound/${inbound.id}/transition`, { method: 'POST', token, body: { status: 'ARRIVED', vehicleNo: 'MH12AB1234' } });
    const line = db.inboundLines.find((item) => item.consignmentId === inbound.id);
    const received = await adminCall(`/inbound/${inbound.id}/receive`, { method: 'POST', token, body: { lines: [{ id: line.id, sellable: 7, damaged: 1, missing: 2, note: 'Carton seal broken' }] } });
    expect(received.status).toBe(200);
    const detail = await inventoryApi.inboundDetail(inbound.id);
    expect(detail.discrepancyUnits).toBe(3);
    expect(detail.ledger.some((entry) => entry.reference === inbound.id)).toBe(true);
    const dispute = await inventoryApi.disputeInbound(inbound.id, { reason: 'Dispatch photos show all ten units.', evidenceMediaIds: ['MED-EVIDENCE'] });
    expect(dispute.status).toBe('OPEN');
  });

  it('blocks warehouse deactivation while active stock remains', async () => {
    const list = await api.get('/inventory', { pageSize: 500, fulfillmentType: 'SELLER' });
    const row = list.data.find((item) => item.fulfillmentType === 'SELLER' && item.sellable > 0);
    expect(row).toBeTruthy();
    const warehouse = (await settingsApi.warehouses()).find((item) => item.id === row.warehouseId);
    if (warehouse.isPrimary) {
      await settingsApi.createWarehouse({ label: 'Alternate', line1: '1 Test Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', contactName: 'Ops', contactPhone: '9999999999', isPrimary: true });
    }
    await expect(settingsApi.deactivateWarehouse(row.warehouseId)).rejects.toMatchObject({ code: 'WAREHOUSE_HAS_DEPENDENCIES' });
  });

  it('reports bulk version conflicts and retries only failed rows', async () => {
    const list = await api.get('/inventory', { pageSize: 500, fulfillmentType: 'SELLER' });
    const rows = list.data.filter((item) => item.fulfillmentType === 'SELLER').slice(0, 2);
    expect(rows).toHaveLength(2);
    const job = await inventoryApi.bulkStock([
      { inventoryId: rows[0].id, sellable: rows[0].sellable + 1, version: rows[0].version },
      { inventoryId: rows[1].id, sellable: rows[1].sellable + 1, version: rows[1].version - 1 },
    ]);
    expect(job.status).toBe('COMPLETED_WITH_ERRORS');
    expect(job.results.filter((item) => item.status === 'FAILED')).toHaveLength(1);
    const current = db.inventory.find((item) => item.id === rows[1].id);
    const retry = await inventoryApi.retryBulkStock(job.id, [{ inventoryId: current.id, sellable: current.sellable + 1, version: current.version }]);
    expect(retry.results).toHaveLength(1);
    expect(retry.status).toBe('COMPLETED');
  });

  it('tracks a removal from request through approval, dispatch and delivery', async () => {
    const list = await api.get('/inventory', { pageSize: 500, fulfillmentType: 'ARISE' });
    const row = list.data.find((item) => item.fulfillmentType === 'ARISE' && item.sellable > 0);
    expect(row).toBeTruthy();
    const removal = await inventoryApi.createRemoval(row.id, { qty: 1, type: 'RETURN_TO_SELLER' });
    const token = await signInAdmin();
    expect((await adminCall(`/removal-orders/${removal.id}/approve`, { method: 'POST', token })).json.data.status).toBe('APPROVED');
    expect((await adminCall(`/removal-orders/${removal.id}/dispatch`, { method: 'POST', token, body: { awb: 'AWB-S13' } })).json.data.status).toBe('SHIPPED');
    expect((await adminCall(`/removal-orders/${removal.id}/deliver`, { method: 'POST', token })).json.data.status).toBe('DELIVERED_TO_SELLER');
    expect((await inventoryApi.removals()).find((item) => item.id === removal.id).status).toBe('DELIVERED_TO_SELLER');
  });
});
