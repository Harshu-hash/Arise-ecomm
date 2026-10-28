import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import { useSessionStore } from '@core/auth/sessionStore';
import { db } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { sellerHandlers } from '@seller/mocks/handlers';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { sellerAuthApi } from '../auth/api/auth.api';
import { listingsApi } from './api/listings.api';

/**
 * Exercises the seller listings HTTP layer against the real MSW handlers, and
 * proves the Phase S2 golden loop: a listing a seller creates lands in the
 * shared QC queue the admin panel reads.
 */
const server = setupServer(...sellerHandlers);

async function signInAsOwner() {
  const payload = await sellerAuthApi.login({ email: 'owner@arise.test', password: 'Arise@123456' });
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

describe('seller listings API (golden loop)', () => {
  beforeAll(() => {
    setApiBaseUrl('/api/seller/v1');
    server.listen({ onUnhandledRequest: 'error' });
  });
  beforeEach(() => {
    seedAll();
    seedSellerAccounts();
  });
  afterEach(() => {
    server.resetHandlers();
    useSessionStore.getState().setAnonymous();
  });
  afterAll(() => {
    server.close();
    setApiBaseUrl('/api/admin/v1');
  });

  it('lists the signed-in seller’s own listings only', async () => {
    const user = await signInAsOwner();
    const res = await listingsApi_list();
    expect(res.data.length).toBeGreaterThan(0);
    // Every row belongs to one of the seller's own offers.
    const ownOfferIds = new Set(db.offers.filter((o) => o.sellerId === user.sellerId).map((o) => o.id));
    expect(res.data.every((row) => ownOfferIds.has(row.id))).toBe(true);
  });

  it('creates a listing that appears in the admin QC queue', async () => {
    const user = await signInAsOwner();
    const leaf = db.categories.find((c) => c.level === 3);

    const before = db.listingSubmissions.filter((s) => s.status === 'QC_PENDING').length;
    const created = await listingsApi.create({
      title: 'Nova Integration Test Tee',
      categoryId: leaf.id,
      mrpPaise: 99900,
      sellingPricePaise: 49900,
      stock: 25,
      highlights: ['Soft cotton'],
      images: ['https://example.com/a.jpg'],
    });

    expect(created.status).toBe('QC_PENDING');
    // A new QC submission exists, scoped to this seller — the admin's view of it.
    const afterRows = db.listingSubmissions.filter((s) => s.status === 'QC_PENDING');
    expect(afterRows.length).toBe(before + 1);
    const mine = afterRows.find((s) => s.productTitle === 'Nova Integration Test Tee');
    expect(mine).toBeTruthy();
    expect(mine.sellerId).toBe(user.sellerId);
    expect(mine.type).toBe('NEW');
  });

  it('rejects a selling price above MRP', async () => {
    await signInAsOwner();
    const leaf = db.categories.find((c) => c.level === 3);
    await expect(
      listingsApi.create({ title: 'Bad Price', categoryId: leaf.id, mrpPaise: 10000, sellingPricePaise: 20000, stock: 1 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('updates stock and reflects it on the listing', async () => {
    await signInAsOwner();
    const list = await listingsApi_list();
    const row = list.data[0];
    const updated = await listingsApi.setStock(row.id, 0);
    expect(updated.stock).toBe(0);
  });

  it('creates a multi-variant listing with distinct per-variant price and stock', async () => {
    const user = await signInAsOwner();
    const leaf = db.categories.find((c) => c.level === 3);

    const created = await listingsApi.create({
      title: 'Nova Variant Matrix Tee',
      categoryId: leaf.id,
      returnPolicy: { windowDays: 10, type: 'RETURN' },
      variants: [
        { attributes: { colour: 'Red', size: 'M' }, sku: 'NVM-RED-M', mrpPaise: 99900, sellingPricePaise: 49900, stock: 10 },
        { attributes: { colour: 'Red', size: 'L' }, sku: 'NVM-RED-L', mrpPaise: 99900, sellingPricePaise: 54900, stock: 5 },
        { attributes: { colour: 'Blue', size: 'M' }, sku: 'NVM-BLUE-M', mrpPaise: 109900, sellingPricePaise: 59900, stock: 0 },
      ],
    });

    const offers = db.offers.filter((o) => o.productId === created.productId && o.sellerId === user.sellerId);
    expect(offers).toHaveLength(3);
    const bySku = Object.fromEntries(
      offers.map((o) => [db.variants.find((v) => v.id === o.variantId).sku, o]),
    );
    expect(bySku['NVM-RED-M'].sellingPricePaise).toBe(49900);
    expect(bySku['NVM-RED-L'].sellingPricePaise).toBe(54900);
    expect(bySku['NVM-BLUE-M'].sellingPricePaise).toBe(59900);
    expect(bySku['NVM-BLUE-M'].stock).toBe(0);

    const product = db.products.find((p) => p.id === created.productId);
    expect(product.returnPolicy).toEqual({ windowDays: 10, type: 'RETURN' });
    expect(product.variantDefiningAttrs).toEqual(['colour', 'size']);
  });

  it('saves a draft listing without price/stock and submits it for QC later', async () => {
    const user = await signInAsOwner();
    const leaf = db.categories.find((c) => c.level === 3);

    const created = await listingsApi.create({
      title: 'Nova Draft Tee',
      categoryId: leaf.id,
      status: 'DRAFT',
    });
    expect(created.status).toBe('DRAFT');
    expect(created.productStatus).toBe('DRAFT');

    const offer = db.offers.find((o) => o.productId === created.productId && o.sellerId === user.sellerId);
    offer.mrpPaise = 10000;
    offer.sellingPricePaise = 9000;
    offer.stock = 3;

    const submitted = await listingsApi.update(created.id, { submitForQc: true });
    expect(submitted.productStatus).toBe('QC_PENDING');
    expect(db.listingSubmissions.find((s) => s.productId === created.productId)).toBeTruthy();
  });
});

// useListQuery hits api.get directly; mirror that for the list endpoint here.
async function listingsApi_list(params) {
  const { api } = await import('@core/api/axiosInstance');
  return api.get('/listings', params);
}
