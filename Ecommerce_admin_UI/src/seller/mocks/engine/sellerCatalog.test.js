import { beforeAll, describe, expect, it } from 'vitest';
import { db, find, findById, id, insert } from '@mocks/db/store';
import { seedAll } from '@mocks/seed';
import { seedSellerAccounts } from '@seller/mocks/seed/sellerAccounts';
import { listingRow, sellerListings, submitForQc } from './sellerCatalog';

describe('seller catalog engine (the QC loop)', () => {
  let sellerId;

  beforeAll(() => {
    seedAll();
    seedSellerAccounts();
    sellerId = find('sellerUsers', (u) => u.email === 'owner@arise.test').sellerId;
  });

  it('surfaces the seller’s seeded offers as listing rows', () => {
    const rows = sellerListings(sellerId);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row).toHaveProperty('productTitle');
    expect(row).toHaveProperty('status');
    expect(typeof row.sellingPricePaise).toBe('number');
  });

  it('a new submission lands in the shared QC queue the admin reads', () => {
    const seller = findById('sellers', sellerId);
    const product = insert('products', {
      id: id('FSN', 6),
      title: 'Test Listing From Seller',
      brandId: null,
      brandName: 'Nova',
      categoryId: db.categories.find((c) => c.level === 3)?.id,
      categoryPath: 'Test › Leaf',
      status: 'QC_PENDING',
      description: 'x',
      highlights: [],
      attributes: {},
      hsnCode: '6109',
      gstRate: 5,
      images: ['a', 'b'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const before = db.listingSubmissions.length;
    const submission = submitForQc(product, seller, 'NEW');
    expect(db.listingSubmissions.length).toBe(before + 1);
    expect(submission.status).toBe('QC_PENDING');
    expect(submission.type).toBe('NEW');
    expect(submission.sellerId).toBe(sellerId);
    expect(Array.isArray(submission.autoChecks)).toBe(true);
    // The admin Listing QC Queue lists exactly QC_PENDING / NEEDS_CHANGES rows.
    const adminVisible = db.listingSubmissions.filter((s) => ['QC_PENDING', 'NEEDS_CHANGES'].includes(s.status));
    expect(adminVisible.some((s) => s.id === submission.id)).toBe(true);
  });

  it('a product needing changes is flagged on its listing row', () => {
    const offer = find('offers', (o) => o.sellerId === sellerId);
    const product = findById('products', offer.productId);
    product.status = 'NEEDS_CHANGES';
    const row = listingRow(offer);
    expect(row.needsChanges).toBe(true);
    expect(row.status).toBe('NEEDS_CHANGES');
  });
});
