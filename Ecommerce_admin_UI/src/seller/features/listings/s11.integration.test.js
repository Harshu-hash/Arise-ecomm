import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db } from '@mocks/db/store';
import { resetSettings, updateSettings } from '@mocks/engine/settings';
import { handlers as adminHandlers } from '@mocks/handlers';
import { seedAll } from '@mocks/seed';
import { DEMO_PASSWORD } from '@mocks/seed/adminUsers';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { signInSeller } from '@seller/test/signInSeller';
import { listingsApi } from './api/listings.api';

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
    body: { email: 'catalog@arise.test', password: DEMO_PASSWORD },
  });
  const { challengeId, devHint, stage } = login.json.data;
  const verified = await adminCall(`/auth/2fa/${stage === 'enrol_2fa' ? 'enrol' : 'verify'}`, {
    method: 'POST',
    body: { challengeId, code: devHint.code },
  });
  return verified.json.data;
}

function unsoldLiveProduct(sellerId) {
  return db.products.find(
    (product) =>
      product.status === 'LIVE' &&
      db.variants.some(
        (variant) =>
          variant.productId === product.id &&
          !db.offers.some((offer) => offer.variantId === variant.id && offer.sellerId === sellerId),
      ),
  );
}

describe('S11 seller catalogue completion', () => {
  beforeAll(() => {
    setApiBaseUrl('/api/seller/v1');
    server.listen({ onUnhandledRequest: 'error' });
  });
  beforeEach(() => {
    seedAll();
    seedSellerAccounts();
    resetSettings();
    updateSettings({ latencyMs: 0 });
  });
  afterEach(() => {
    server.resetHandlers();
    useSessionStore.getState().setAnonymous();
  });
  afterAll(() => {
    server.close();
    setApiBaseUrl('/api/admin/v1');
  });

  it('attaches an offer to an existing canonical product without changing its content', async () => {
    const user = await signInSeller();
    const product = unsoldLiveProduct(user.sellerId);
    const before = JSON.stringify(product);
    const variant = db.variants.find(
      (item) =>
        item.productId === product.id &&
        !db.offers.some((offer) => offer.variantId === item.id && offer.sellerId === user.sellerId),
    );
    const result = await listingsApi.attachOffers(product.id, {
      offers: [
        {
          variantId: variant.id,
          sellerSku: 'OWN-1',
          mrpPaise: 50000,
          sellingPricePaise: 45000,
          stock: 4,
        },
      ],
    });
    expect(result.offers).toHaveLength(1);
    expect(JSON.stringify(db.products.find((item) => item.id === product.id))).toBe(before);
  });

  it('takes a multi-variant product through two-field correction, approval, and matching preview', async () => {
    await signInSeller();
    const category = db.categories.find((item) => item.level === 3);
    const created = await listingsApi.create({
      title: 'S11 Original title',
      categoryId: category.id,
      description: 'Short',
      variants: [
        {
          sku: 'S11-RED',
          label: 'Red',
          attributes: { colour: 'Red' },
          mrpPaise: 100000,
          sellingPricePaise: 80000,
          stock: 3,
        },
        {
          sku: 'S11-BLUE',
          label: 'Blue',
          attributes: { colour: 'Blue' },
          mrpPaise: 100000,
          sellingPricePaise: 81000,
          stock: 2,
        },
      ],
    });
    const submission = db.listingSubmissions.find((item) => item.productId === created.productId);
    const admin = await signInAdmin();
    const requested = await adminCall(`/listing-submissions/${submission.id}/decide`, {
      method: 'POST',
      token: admin.accessToken,
      body: {
        decision: 'REQUEST_CHANGES',
        issues: [
          { field: 'title', message: 'Clarify title.' },
          { field: 'description', message: 'Expand description.' },
        ],
      },
    });
    expect(requested.status).toBe(200);
    await listingsApi.update(created.id, {
      title: 'S11 Corrected title',
      description: 'A complete corrected customer description with the requested product details.',
    });
    const approved = await adminCall(`/listing-submissions/${submission.id}/decide`, {
      method: 'POST',
      token: admin.accessToken,
      body: { decision: 'APPROVE' },
    });
    expect(approved.status).toBe(200);
    const detail = await listingsApi.detail(created.id);
    expect(detail.product.status).toBe('LIVE');
    expect(detail.preview.title).toBe(detail.product.title);
    expect(detail.preview.images).toEqual(detail.product.images);
    expect(detail.preview.variants.map((item) => item.id)).toEqual(
      detail.variants.map((item) => item.id),
    );
  });

  it('preflights bulk prices, commits valid rows, and retries corrected failures', async () => {
    const user = await signInSeller();
    const offers = db.offers.filter((item) => item.sellerId === user.sellerId).slice(0, 2);
    const rows = [
      { listingId: offers[0].id, price: '100' },
      { listingId: offers[1].id, price: '-2' },
    ];
    const preflight = await listingsApi.bulkPreflight({ operation: 'UPDATE_PRICE', rows });
    expect(preflight.validRows).toBe(1);
    expect(preflight.invalidRows).toBe(1);
    const job = await listingsApi.createBulkJob({ operation: 'UPDATE_PRICE', rows });
    expect(job.status).toBe('COMPLETED_WITH_ERRORS');
    expect(db.offers.find((item) => item.id === offers[0].id).sellingPricePaise).toBe(10000);
    const retry = await listingsApi.retryBulkJob(job.id, [
      { listingId: offers[1].id, price: '100' },
    ]);
    expect(retry.status).toBe('COMPLETED');
    expect(retry.parentJobId).toBe(job.id);
  });

  it('deactivates only the seller offer and preserves the live canonical product', async () => {
    const user = await signInSeller();
    const product = unsoldLiveProduct(user.sellerId);
    const variant = db.variants.find(
      (item) =>
        item.productId === product.id &&
        !db.offers.some((offer) => offer.variantId === item.id && offer.sellerId === user.sellerId),
    );
    const attached = await listingsApi.attachOffers(product.id, {
      offers: [
        {
          variantId: variant.id,
          sellerSku: 'S11-OFFER',
          mrpPaise: 50000,
          sellingPricePaise: 40000,
          stock: 5,
        },
      ],
    });
    const offer = attached.offers[0];
    await listingsApi.lifecycle(offer.id, 'deactivate', { reason: 'Temporarily unavailable.' });
    expect(db.offers.find((item) => item.id === offer.id).status).toBe('INACTIVE');
    expect(db.products.find((item) => item.id === product.id).status).toBe('LIVE');
    const preview = await listingsApi.preview(offer.id);
    expect(preview.variants.find((item) => item.id === variant.id).offer?.id).not.toBe(offer.id);
  });

  it('keeps live content unchanged until its revision is approved', async () => {
    const user = await signInSeller();
    const offer = db.offers.find(
      (item) =>
        item.sellerId === user.sellerId &&
        db.products.find((product) => product.id === item.productId)?.status === 'LIVE',
    );
    const original = db.products.find((item) => item.id === offer.productId).title;
    await listingsApi.update(offer.id, { title: 'Pending S11 revision title' });
    expect(db.products.find((item) => item.id === offer.productId).title).toBe(original);
    const submission = db.listingSubmissions.find(
      (item) =>
        item.productId === offer.productId &&
        item.type === 'REVISION' &&
        item.status === 'QC_PENDING',
    );
    const admin = await signInAdmin();
    await adminCall(`/listing-submissions/${submission.id}/decide`, {
      method: 'POST',
      token: admin.accessToken,
      body: { decision: 'APPROVE' },
    });
    expect(db.products.find((item) => item.id === offer.productId).title).toBe(
      'Pending S11 revision title',
    );
  });
});
