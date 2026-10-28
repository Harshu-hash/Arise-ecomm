import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl, api } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find, findById, update } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { ordersApi } from './api/orders.api';

const server = setupServer(...sellerHandlers);

async function signIn() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

/** Force a SELLER shipment for `sellerId` to a clean PLACED start state. */
function freshPlacedShipment(sellerId) {
  const shipment = find('shipments', (s) => s.sellerId === sellerId && s.fulfillmentType === 'SELLER');
  update('shipments', shipment.id, { status: 'PLACED', awb: null, courierId: null, courierName: null, invoiceNo: null });
  for (const item of filter('orderItems', (i) => i.shipmentId === shipment.id)) {
    update('orderItems', item.id, { status: 'PLACED' });
  }
  return shipment.id;
}

describe('seller order fulfilment (confirm → dispatch)', () => {
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
  afterEach(() => {
    server.resetHandlers();
    useSessionStore.getState().setAnonymous();
  });
  afterAll(() => {
    server.close();
    setApiBaseUrl('/api/admin/v1');
  });

  it('lists only the seller’s own shipments', async () => {
    const res = await api.get('/orders', { pageSize: 100 });
    const ownIds = new Set(filter('shipments', (s) => s.sellerId === sellerId).map((s) => s.id));
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((row) => ownIds.has(row.id))).toBe(true);
  });

  it('advances a shipment through the full flow, writing events the admin reads', async () => {
    const shipmentId = freshPlacedShipment(sellerId);

    let row = await ordersApi.confirm(shipmentId);
    expect(row.status).toBe('ACCEPTED');
    row = await ordersApi.pack(shipmentId);
    expect(row.status).toBe('PACKED');
    expect(row.invoiceNo).toBeTruthy();
    row = await ordersApi.manifest(shipmentId);
    expect(row.status).toBe('MANIFESTED');
    expect(row.awb).toBeTruthy();
    expect(row.courierName).toBeTruthy();
    row = await ordersApi.dispatch(shipmentId);
    expect(row.status).toBe('SHIPPED');

    // The item and the shared shipment agree, and the admin-visible timeline
    // records each seller action.
    const items = filter('orderItems', (i) => i.shipmentId === shipmentId);
    expect(items.every((i) => i.status === 'SHIPPED')).toBe(true);
    const itemIds = new Set(items.map((i) => i.id));
    const events = filter('orderEvents', (e) => itemIds.has(e.itemId) && e.actorType === 'SELLER');
    expect(events.map((e) => e.status)).toEqual(expect.arrayContaining(['ACCEPTED', 'PACKED', 'MANIFESTED', 'SHIPPED']));
  });

  it('refuses an out-of-order transition', async () => {
    const shipmentId = freshPlacedShipment(sellerId);
    await expect(ordersApi.dispatch(shipmentId)).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION' });
  });

  it('cancels a prepaid order and creates a refund', async () => {
    const shipmentId = freshPlacedShipment(sellerId);
    const order = findById('orders', findById('shipments', shipmentId).orderId);
    update('orders', order.id, { paymentMethod: 'UPI' });
    const before = db.refunds.length;
    const row = await ordersApi.cancel(shipmentId, 'Out of stock');
    expect(row.status).toBe('CANCELLED');
    expect(db.refunds.length).toBe(before + 1);
  });
});
