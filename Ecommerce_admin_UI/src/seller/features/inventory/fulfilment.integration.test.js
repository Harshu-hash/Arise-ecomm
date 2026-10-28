import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find, findById, id, insert, update } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { returnsApi } from '../returns/api/returns.api';
import { inventoryApi } from './api/inventory.api';

const server = setupServer(...sellerHandlers);

async function signIn() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

/** Create a fresh self-ship return on the owner's account for a real order item. */
function makeReturn(sellerId) {
  const item = find('orderItems', (i) => i.sellerId === sellerId);
  update('orderItems', item.id, { fulfillmentType: 'SELLER' });
  return insert('returns', {
    id: id('RET', 6),
    orderId: item.orderId,
    orderItemId: item.id,
    sellerId,
    sellerName: item.sellerName,
    productName: item.name,
    variantLabel: item.variantLabel,
    image: item.image,
    amountPaise: item.linePaise,
    type: 'REFUND',
    reason: 'Item is damaged or defective',
    comments: 'Test return',
    images: [],
    status: 'RETURN_REQUESTED',
    qcResult: null,
    qcNotes: null,
    pickupAwb: null,
    requestedAt: new Date().toISOString(),
    refundId: null,
    version: 1,
  });
}

describe('seller returns, inventory & FBA inbound', () => {
  let sellerId;

  beforeAll(() => {
    setApiBaseUrl('/api/seller/v1');
    server.listen({ onUnhandledRequest: 'error' });
  });
  beforeEach(async () => {
    seedAll();
    seedSellerAccounts();
    sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId;
    await signIn();
  });
  afterEach(() => { server.resetHandlers(); useSessionStore.getState().setAnonymous(); });
  afterAll(() => { server.close(); setApiBaseUrl('/api/admin/v1'); });

  it('an inbound a seller creates appears in the shared warehouse queue', async () => {
    const warehouse = db.warehouses.find((w) => w.type === 'FULFILMENT' && w.status !== 'CLOSED');
    const variantId = find('offers', (o) => o.sellerId === sellerId).variantId;

    const before = db.inboundConsignments.length;
    const created = await inventoryApi.createInbound({ warehouseId: warehouse.id, lines: [{ variantId, qty: 40 }] });
    expect(created.status).toBe('DRAFT');
    const submitted = await inventoryApi.submitInbound(created.id);
    expect(submitted.status).toBe('SUBMITTED');

    // The admin Warehouses/Inbound screen reads db.inboundConsignments.
    expect(db.inboundConsignments.length).toBe(before + 1);
    const row = findById('inboundConsignments', created.id);
    expect(row.sellerId).toBe(sellerId);
    expect(row.createdBySeller).toBe(true);
    expect(filter('inboundLines', (l) => l.consignmentId === created.id)).toHaveLength(1);
  });

  it('lists only the seller’s own inventory and can request a removal', async () => {
    const res = await api.get('/inventory', { pageSize: 100 });
    const ownIds = new Set(filter('inventory', (i) => i.sellerId === sellerId).map((i) => i.id));
    expect(res.data.every((row) => ownIds.has(row.id))).toBe(true);

    if (res.data.length) {
      const row = res.data.find((r) => r.sellable > 0) ?? res.data[0];
      const before = db.removalOrders.length;
      await inventoryApi.createRemoval(row.id, { qty: 1, type: 'RETURN_TO_SELLER' });
      expect(db.removalOrders.length).toBe(before + 1);
    }
  });

  it('approves a return, schedules pickup, and refunds on QC pass', async () => {
    const ret = makeReturn(sellerId);

    let r = await returnsApi.approve(ret.id);
    expect(r.status).toBe('PICKUP_SCHEDULED');
    expect(r.pickupAwb).toBeTruthy();
    r = await returnsApi.receive(ret.id);
    expect(r.status).toBe('RECEIVED');

    const before = db.refunds.length;
    r = await returnsApi.qc(ret.id, { result: 'PASS', notes: 'All good' });
    expect(r.status).toBe('CLOSED');
    expect(db.refunds.length).toBe(before + 1);
  });

  it('rejects a return with a reason', async () => {
    const ret = makeReturn(sellerId);
    const r = await returnsApi.reject(ret.id, 'Outside the return window');
    expect(r.status).toBe('RETURN_REJECTED');
  });
});
