import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db, filter, find, findById, insert, update } from '@mocks/db/store';
import { recordEvent } from '@mocks/engine/orderState';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { handlers as adminHandlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { logisticsApi } from '@seller/features/logistics/api/logistics.api';
import { ordersApi } from './api/orders.api';

const server = setupServer(...adminHandlers, ...sellerHandlers);
const ADMIN_BASE = `${window.location.origin}/api/admin/v1`;

async function adminCall(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${ADMIN_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signInAdmin() {
  const login = await adminCall('/auth/login', {
    method: 'POST',
    body: { email: 'ops@arise.test', password: DEMO_PASSWORD },
  });
  const { challengeId, devHint, stage } = login.json.data;
  const verified = await adminCall(`/auth/2fa/${stage === 'enrol_2fa' ? 'enrol' : 'verify'}`, {
    method: 'POST',
    body: { challengeId, code: devHint.code },
  });
  return verified.json.data;
}

function freshShipment(sellerId, status = 'PLACED') {
  const shipment = find(
    'shipments',
    (row) => row.sellerId === sellerId && row.fulfillmentType === 'SELLER',
  );
  update('shipments', shipment.id, {
    status,
    awb: null,
    courierId: null,
    courierName: null,
    invoiceNo: null,
    manifestId: null,
    packages: [],
    scans: [],
  });
  filter('orderItems', (item) => item.shipmentId === shipment.id).forEach((item) =>
    update('orderItems', item.id, { status }),
  );
  return findById('shipments', shipment.id);
}

describe('S12 seller dispatch, documents and logistics', () => {
  let user;
  beforeAll(() => {
    setApiBaseUrl('/api/seller/v1');
    server.listen({ onUnhandledRequest: 'error' });
  });
  beforeEach(async () => {
    seedAll();
    seedSellerAccounts();
    resetSettings();
    updateSettings({ latencyMs: 0 });
    user = await signInSeller();
  });
  afterEach(() => {
    server.resetHandlers();
    useSessionStore.getState().setAnonymous();
  });
  afterAll(() => {
    server.close();
    setApiBaseUrl('/api/admin/v1');
  });

  it('isolates the seller fulfilment inside a multi-seller customer order', async () => {
    const shipment = db.shipments.find(
      (row) => row.sellerId === user.sellerId && findById('orders', row.orderId)?.sellerCount > 1,
    );
    expect(shipment).toBeTruthy();
    const detail = await ordersApi.detail(shipment.id);
    const sellerItemIds = new Set(
      filter('orderItems', (item) => item.shipmentId === shipment.id).map((item) => item.id),
    );
    expect(detail.items.every((item) => sellerItemIds.has(item.id))).toBe(true);
    expect(
      detail.items.every((item) => findById('orderItems', item.id).sellerId === user.sellerId),
    ).toBe(true);
    expect(detail.items.length).toBeLessThan(
      filter('orderItems', (item) => item.orderId === shipment.orderId).length,
    );
  });

  it('scans items, records package data, generates downloadable documents and hands over', async () => {
    const shipment = freshShipment(user.sellerId);
    await ordersApi.confirm(shipment.id);
    const items = filter('orderItems', (item) => item.shipmentId === shipment.id);
    await ordersApi.createPackages(shipment.id, [
      { itemIds: items.map((item) => item.id), weightG: 760, dimsCm: { l: 32, w: 22, h: 12 } },
    ]);
    for (const item of items) await ordersApi.scan(shipment.id, item.id, 'PACK');
    await ordersApi.pack(shipment.id);
    const invoice = await ordersApi.generateDocument(shipment.id, 'TAX_INVOICE');
    const slip = await ordersApi.generateDocument(shipment.id, 'PACKING_SLIP');
    await ordersApi.manifest(shipment.id);
    const manifested = findById('shipments', shipment.id);
    const label = await ordersApi.generateDocument(shipment.id, 'SHIPPING_LABEL');
    const manifest = await ordersApi.generateDocument(shipment.id, 'MANIFEST');
    expect(
      [invoice, slip, label, manifest].every(
        (document) => document.version === 1 && document.downloadUrl,
      ),
    ).toBe(true);
    const blob = await ordersApi.downloadDocument(invoice.downloadUrl);
    expect(blob.size).toBeGreaterThan(20);
    await ordersApi.scan(shipment.id, manifested.awb, 'HANDOVER');
    const result = await logisticsApi.batch({
      action: 'HANDOVER',
      ids: [shipment.id, 'SHP-NOT-OWNED'],
    });
    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
    expect(findById('shipments', shipment.id).status).toBe('SHIPPED');
    expect(findById('shipments', shipment.id).manifestId).toBeTruthy();
  });

  it('projects seller and courier events into one chronologically ordered timeline', async () => {
    const shipment = freshShipment(user.sellerId);
    await ordersApi.confirm(shipment.id);
    await ordersApi.pack(shipment.id);
    await ordersApi.manifest(shipment.id);
    await ordersApi.dispatch(shipment.id);
    const item = filter('orderItems', (row) => row.shipmentId === shipment.id)[0];
    recordEvent({
      orderId: shipment.orderId,
      itemId: item.id,
      status: 'IN_TRANSIT',
      actorType: 'COURIER',
      actorName: 'Courier webhook',
      note: 'Reached sorting hub',
    });
    const detail = await ordersApi.detail(shipment.id);
    expect(detail.timeline.map((event) => event.status)).toEqual(
      expect.arrayContaining(['ACCEPTED', 'PACKED', 'MANIFESTED', 'SHIPPED', 'IN_TRANSIT']),
    );
    expect(
      detail.timeline.every(
        (event, index, events) =>
          index === 0 || new Date(event.at) >= new Date(events[index - 1].at),
      ),
    ).toBe(true);
  });

  it('submits an NDR decision before SLA and exposes it to admin operations', async () => {
    let ndr = db.ndrRecords.find(
      (row) =>
        own(row.shipmentId, user.sellerId) &&
        row.status === 'OPEN' &&
        new Date(row.actionDueAt).getTime() > Date.now(),
    );
    if (!ndr) {
      const shipment = freshShipment(user.sellerId, 'UNDELIVERED');
      ndr = insert('ndrRecords', {
        id: 'NDR-S12',
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        awb: 'AWB-S12',
        reason: 'Customer unavailable',
        attempt: 1,
        openedAt: new Date(Date.now() - 3600_000).toISOString(),
        actionDueAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
        status: 'OPEN',
        version: 1,
      });
    }
    const response = await logisticsApi.respondNdr(ndr.id, {
      action: 'REATTEMPT',
      note: 'Customer confirmed delivery after 6pm.',
    });
    expect(response).toMatchObject({ status: 'REATTEMPT_REQUESTED', resolution: 'REATTEMPT' });
    const admin = await signInAdmin();
    const queue = await adminCall('/ndr?pageSize=100', { token: admin.accessToken });
    expect(queue.status).toBe(200);
    expect(queue.json.data.find((row) => row.id === ndr.id)).toMatchObject({
      sellerResponse: 'Customer confirmed delivery after 6pm.',
    });
  });

  it('creates a durable weight dispute and receives an admin resolution', async () => {
    let dispute = db.weightDisputes.find(
      (row) =>
        row.sellerId === user.sellerId &&
        !['ACCEPTED', 'REJECTED', 'AUTO_ACCEPTED'].includes(row.status) &&
        new Date(row.respondByAt).getTime() > Date.now(),
    );
    if (!dispute) {
      const shipment = db.shipments.find((row) => row.sellerId === user.sellerId && row.awb);
      const item = db.orderItems.find((row) => row.shipmentId === shipment.id);
      const variant = findById('variants', item.variantId);
      dispute = insert('weightDisputes', {
        id: 'WDS-S12',
        shipmentId: shipment.id,
        awb: shipment.awb,
        orderId: shipment.orderId,
        sellerId: user.sellerId,
        sellerName: shipment.sellerName,
        courierId: shipment.courierId,
        courierName: shipment.courierName,
        sku: variant.sku,
        declaredWeightG: 500,
        chargedWeightG: 900,
        differenceG: 400,
        extraChargePaise: 1500,
        courierImages: [],
        sellerEvidence: [],
        status: 'SELLER_NOTIFIED',
        raisedAt: new Date().toISOString(),
        respondByAt: new Date(Date.now() + 5 * 86400_000).toISOString(),
        version: 1,
      });
    }
    expect(dispute).toBeTruthy();
    const media = insert('mediaResources', {
      id: 'MED-S12',
      mediaId: 'MED-S12',
      sellerId: user.sellerId,
      fileName: 'scale.pdf',
      mimeType: 'application/pdf',
      status: 'READY',
    });
    dispute = await logisticsApi.disputeWeight(dispute.id, {
      reason: 'Courier scale includes pallet weight.',
      evidence: [media],
    });
    expect(dispute.status).toBe('DISPUTED_BY_SELLER');
    expect(dispute.sellerEvidence[0].mediaId).toBe('MED-S12');
    const admin = await signInAdmin();
    const decided = await adminCall(`/weight-disputes/${dispute.id}/decide`, {
      method: 'POST',
      token: admin.accessToken,
      body: { decision: 'REJECTED', reason: 'Seller scale evidence verified.' },
    });
    expect(decided.status).toBe(200);
    expect(findById('weightDisputes', dispute.id)).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'Seller scale evidence verified.',
    });
  });
});

function own(shipmentId, sellerId) {
  return findById('shipments', shipmentId)?.sellerId === sellerId;
}
