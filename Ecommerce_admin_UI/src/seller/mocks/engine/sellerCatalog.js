import { db, filter, findById, id, insert, update } from '@mocks/db/store';
import { isAriseAssured, rankOffers } from '@mocks/engine/buyBox';
import { mockNow, mockNowIso } from '@mocks/engine/settings';

/**
 * Catalog helpers for the seller panel. They write the same shared collections
 * (`products`, `variants`, `offers`, `listingSubmissions`) the admin catalog
 * reads, so a seller's new listing lands in the admin Listing QC Queue and an
 * admin decision flows straight back to the seller's listing status.
 */

/** Recompute the buy-box winner + Arise Assured badge for a variant's offers. */
export function recomputeBuyBox(variantId) {
  const offers = filter('offers', (o) => o.variantId === variantId);
  for (const o of offers) o.buyBoxWinner = false;
  const rules = findById('settings', 'buyBoxRules');
  if (!rules) return;
  const sellerById = new Map(offers.map((o) => [o.sellerId, findById('sellers', o.sellerId)]));
  const ranked = rankOffers(offers, sellerById, rules.weights);
  if (ranked[0]) findById('offers', ranked[0].id).buyBoxWinner = true;
  for (const offer of offers) {
    offer.ariseAssured = isAriseAssured(offer, sellerById.get(offer.sellerId), rules.ariseAssured);
  }
}

/** The automated QC pass a reviewer sees first (mirrors the seed's version). */
export function buildAutoChecks(product) {
  const offers = filter('offers', (o) => o.productId === product.id);
  const priceAboveMrp = offers.some((o) => o.sellingPricePaise > o.mrpPaise);
  const missingAttrs = Object.keys(product.attributes ?? {}).length < 4;
  const brand = product.brandId ? findById('brands', product.brandId) : null;
  return [
    { key: 'mandatory_attributes', label: 'Mandatory attributes present', result: missingAttrs ? 'WARN' : 'PASS', detail: missingAttrs ? 'Fewer than 4 attributes filled in.' : null },
    { key: 'image_quality', label: 'Images meet 1000×1000 minimum', result: (product.images?.length ?? 0) > 1 ? 'PASS' : 'WARN', detail: (product.images?.length ?? 0) > 1 ? null : 'Only one image supplied.' },
    { key: 'price_vs_mrp', label: 'Selling price at or below MRP', result: priceAboveMrp ? 'FAIL' : 'PASS', detail: priceAboveMrp ? 'One offer is priced above MRP.' : null },
    { key: 'prohibited_words', label: 'No prohibited keywords', result: 'PASS', detail: null },
    { key: 'brand_authorisation', label: 'Brand authorisation on file', result: brand?.gated ? 'WARN' : 'PASS', detail: brand?.gated ? `${brand.name} is a gated brand — check authorisation.` : null },
    { key: 'hsn_match', label: 'HSN matches the category', result: product.hsnCode ? 'PASS' : 'FAIL', detail: product.hsnCode ? null : 'No HSN code set.' },
  ];
}

/** Open (undecided) QC submission for a product, if any. */
export function openSubmissionFor(productId) {
  return db.listingSubmissions.find(
    (s) => s.productId === productId && ['QC_PENDING', 'NEEDS_CHANGES', 'PENDING'].includes(s.status),
  );
}

/** Creates (or refreshes) the QC submission for a product the seller submitted. */
export function submitForQc(product, seller, type = 'NEW') {
  const existing = openSubmissionFor(product.id);
  const autoChecks = buildAutoChecks(product);
  if (existing) {
    return update('listingSubmissions', existing.id, {
      status: 'QC_PENDING',
      type,
      submittedAt: mockNowIso(),
      autoChecks,
      issues: [],
    });
  }
  return insert('listingSubmissions', {
    id: id('QC', 6),
    productId: product.id,
    productTitle: product.title,
    productImage: product.images?.[0] ?? null,
    sellerId: seller?.id ?? null,
    sellerName: seller?.storeName ?? '—',
    sellerTier: seller?.tier ?? 'BRONZE',
    categoryId: product.categoryId,
    categoryPath: product.categoryPath,
    type,
    status: 'QC_PENDING',
    submittedAt: mockNowIso(),
    priority: seller?.tier === 'PLATINUM' ? 'HIGH' : 'NORMAL',
    assignedToId: null,
    autoChecks,
    issues: [],
    version: 1,
  });
}

/**
 * One "listing" row from the seller's point of view: their offer joined with
 * the product and variant it sits on, plus any open QC submission state.
 */
export function listingRow(offer) {
  const product = findById('products', offer.productId);
  const variant = findById('variants', offer.variantId);
  const submission = openSubmissionFor(offer.productId);
  const productStatus = product?.status ?? 'ARCHIVED';
  // The status the seller acts on: QC states from the product, stock state from the offer.
  const status =
    productStatus === 'LIVE'
      ? offer.stock > 0
        ? 'LIVE'
        : 'OUT_OF_STOCK'
      : productStatus;
  return {
    id: offer.id,
    productId: offer.productId,
    variantId: offer.variantId,
    productTitle: product?.title ?? '—',
    productImage: product?.images?.[0] ?? null,
    brandName: product?.brandName ?? null,
    categoryPath: product?.categoryPath ?? null,
    variantLabel: variant?.label ?? null,
    sku: variant?.sku ?? null,
    sellingPricePaise: offer.sellingPricePaise,
    mrpPaise: offer.mrpPaise,
    stock: offer.stock,
    status,
    productStatus,
    fulfillmentType: offer.fulfillmentType,
    buyBoxWinner: offer.buyBoxWinner,
    ariseAssured: offer.ariseAssured,
    submissionId: submission?.id ?? null,
    submissionStatus: submission?.status ?? null,
    needsChanges: productStatus === 'NEEDS_CHANGES',
    updatedAt: product?.updatedAt ?? null,
    createdAt: product?.createdAt ?? null,
  };
}

/** Every offer belonging to a seller, as listing rows. */
export function sellerListings(sellerId) {
  return filter('offers', (o) => o.sellerId === sellerId).map(listingRow);
}

/** Age helper for submissions, matching the admin queue's derived fields. */
export function submissionAge(submittedAt) {
  return Math.floor((mockNow() - new Date(submittedAt).getTime()) / 3600_000);
}
