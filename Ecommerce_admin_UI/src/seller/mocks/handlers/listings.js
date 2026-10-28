import { http as mswHttp } from 'msw';
import { db, filter, findById, id, insert, update } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, okList, ok, unauthorized, validationFailed } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  listingRow,
  openSubmissionFor,
  recomputeBuyBox,
  sellerListings,
  submissionAge,
  submitForQc,
} from '@seller/mocks/engine/sellerCatalog';
import { SELLER_BASE } from './auth';

/** Resolve the caller or short-circuit with 401; returns { user, seller } or { response }. */
function sellerContext(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

/** The seller's offer for a listing id, guarded to their own account. */
function ownOffer(user, offerId) {
  const offer = findById('offers', offerId);
  if (!offer || offer.sellerId !== user.sellerId) return null;
  return offer;
}

function categoryMeta(categoryId) {
  const c = findById('categories', categoryId);
  if (!c) return null;
  return { categoryPath: `${c.rootName} › ${c.name}`, hsnCode: c.hsnCode, gstRate: c.gstRate };
}

export const sellerListingHandlers = [
  /* --------------------------------------------------------- my listings */
  mswHttp.get(`${SELLER_BASE}/listings`, async ({ request }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;

    const query = parseListQuery(new URL(request.url), { defaultSort: '-updatedAt' });
    const rows = sellerListings(ctx.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['productTitle', 'sku', 'productId', 'brandName'],
      filterSpec: { status: 'status', fulfillmentType: 'fulfillmentType' },
      sortable: ['updatedAt', 'createdAt', 'sellingPricePaise', 'stock', 'productTitle'],
      facetFields: ['status'],
    });
    return okList(items, {
      ...meta,
      counts: {
        live: rows.filter((r) => r.status === 'LIVE').length,
        qc: rows.filter((r) => r.productStatus === 'QC_PENDING').length,
        needsChanges: rows.filter((r) => r.needsChanges).length,
        outOfStock: rows.filter((r) => r.status === 'OUT_OF_STOCK').length,
      },
    });
  }),

  /* ------------------------------------------------------- listing detail */
  mswHttp.get(`${SELLER_BASE}/listings/:id`, async ({ request, params }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const offer = ownOffer(ctx.user, params.id);
    if (!offer) return notFound('That listing does not exist on your account.');

    const product = findById('products', offer.productId);
    const variant = findById('variants', offer.variantId);
    const submission = openSubmissionFor(offer.productId);
    return ok({
      ...listingRow(offer),
      product,
      variant,
      submission: submission ? { ...submission, ageHours: submissionAge(submission.submittedAt) } : null,
      competingOffers: filter('offers', (o) => o.variantId === offer.variantId && o.id !== offer.id).length,
    });
  }),

  /* --------------------------------------------------------- new listing */
  mswHttp.post(`${SELLER_BASE}/listings`, async ({ request }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const body = await request.json();
    const isDraft = body?.status === 'DRAFT';

    const fieldErrors = {};
    if (!body?.title) fieldErrors.title = 'Enter a product title.';
    if (!body?.categoryId) fieldErrors.categoryId = 'Pick a category.';

    const variantSpecs = body.variants?.length ? body.variants : [{ label: 'Default', attributes: {} }];
    const effectiveMrp = (v) => Number(v.mrpPaise ?? body?.mrpPaise);
    const effectivePrice = (v) => Number(v.sellingPricePaise ?? body?.sellingPricePaise);
    if (!isDraft) {
      variantSpecs.forEach((v, vi) => {
        const mrp = effectiveMrp(v);
        const price = effectivePrice(v);
        const label = variantSpecs.length > 1 ? ` (variant ${vi + 1})` : '';
        if (!mrp || mrp <= 0) fieldErrors.mrpPaise = `Enter the MRP${label}.`;
        if (!price || price <= 0) fieldErrors.sellingPricePaise = `Enter a selling price${label}.`;
        if (price && mrp && price > mrp) fieldErrors.sellingPricePaise = `Selling price cannot exceed MRP${label}.`;
      });
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const cat = categoryMeta(body.categoryId);
    if (!cat) return badRequest('That category no longer exists.', 'BAD_CATEGORY');
    const brand = body.brandId ? findById('brands', body.brandId) : null;

    const product = insert('products', {
      id: id('FSN', 6),
      title: body.title,
      brandId: brand?.id ?? null,
      brandName: brand?.name ?? body.brandName ?? null,
      categoryId: body.categoryId,
      categoryPath: cat.categoryPath,
      status: isDraft ? 'DRAFT' : 'QC_PENDING',
      description: body.description ?? '',
      highlights: Array.isArray(body.highlights) ? body.highlights.filter(Boolean) : [],
      attributes: body.attributes ?? {},
      hsnCode: cat.hsnCode,
      gstRate: cat.gstRate,
      countryOfOrigin: body.countryOfOrigin ?? 'India',
      sizeChartId: body.sizeChartId ?? null,
      returnPolicy: body.returnPolicy ?? { windowDays: cat.returnWindowDays ?? 7, type: 'RETURN' },
      variantDefiningAttrs: body.variants?.length ? ['colour', 'size'] : [],
      images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
      rating: null,
      ratingCount: 0,
      reviewCount: 0,
      createdAt: mockNowIso(),
      updatedAt: mockNowIso(),
      createdBySellerId: ctx.user.sellerId,
      version: 1,
    });

    let firstOfferId = null;
    variantSpecs.forEach((vspec, vi) => {
      const variant = insert('variants', {
        id: id('VAR', 6),
        productId: product.id,
        sku: vspec.sku || `${(brand?.name ?? 'SKU').toUpperCase().slice(0, 4)}-${product.id}-${vi + 1}`,
        ean: null,
        attributes: vspec.attributes ?? {},
        label: vspec.label ?? `Variant ${vi + 1}`,
        images: Array.isArray(vspec.images) ? vspec.images.filter(Boolean) : [],
        weightG: Number(vspec.weightG ?? body.weightG) || 500,
        dimsCm: vspec.dimsCm ?? body.dimsCm ?? { l: 20, w: 15, h: 5 },
        status: 'ACTIVE',
        version: 1,
      });
      const offer = insert('offers', {
        id: id('OFR', 7),
        productId: product.id,
        variantId: variant.id,
        sellerId: ctx.user.sellerId,
        sellerName: ctx.seller?.storeName ?? '—',
        sellingPricePaise: effectivePrice(vspec) || 0,
        mrpPaise: effectiveMrp(vspec) || 0,
        stock: Number(vspec.stock ?? body.stock) || 0,
        fulfillmentType: body.fulfillmentType === 'ARISE' ? 'ARISE' : 'SELLER',
        dispatchSlaHours: 48,
        status: isDraft ? 'DRAFT' : 'QC_PENDING',
        buyBoxWinner: false,
        ariseAssured: false,
        version: 1,
      });
      if (!firstOfferId) firstOfferId = offer.id;
    });

    if (!isDraft) submitForQc(product, ctx.seller, 'NEW');
    scheduleSave();
    return created(listingRow(findById('offers', firstOfferId)));
  }),

  /* ----------------------------------------------------- edit listing */
  mswHttp.patch(`${SELLER_BASE}/listings/:id`, async ({ request, params }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const offer = ownOffer(ctx.user, params.id);
    if (!offer) return notFound('That listing does not exist on your account.');
    const product = findById('products', offer.productId);
    const body = await request.json();

    const patch = { updatedAt: mockNowIso() };
    for (const key of ['title', 'description', 'highlights', 'attributes', 'images', 'countryOfOrigin', 'returnPolicy', 'sizeChartId']) {
      if (body?.[key] !== undefined) patch[key] = body[key];
    }
    update('products', product.id, patch);

    // A content change on a live listing is logged as a revision for QC, while
    // the listing stays live; anything not yet live simply re-enters the queue.
    const fresh = findById('products', product.id);
    if (fresh.status === 'LIVE') submitForQc(fresh, ctx.seller, 'REVISION');
    else if (fresh.status === 'DRAFT' && body?.submitForQc) {
      update('products', product.id, { status: 'QC_PENDING' });
      for (const o of filter('offers', (x) => x.productId === product.id)) update('offers', o.id, { status: 'QC_PENDING' });
      submitForQc(findById('products', product.id), ctx.seller, 'NEW');
    } else if (['QC_PENDING', 'NEEDS_CHANGES', 'INACTIVE'].includes(fresh.status)) {
      update('products', product.id, { status: 'QC_PENDING' });
      submitForQc(findById('products', product.id), ctx.seller, fresh.status === 'NEEDS_CHANGES' ? 'RESUBMISSION' : 'NEW');
    }
    scheduleSave();
    return ok(listingRow(findById('offers', offer.id)));
  }),

  /* ----------------------------------------------------- price / stock */
  mswHttp.patch(`${SELLER_BASE}/listings/:id/price`, async ({ request, params }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const offer = ownOffer(ctx.user, params.id);
    if (!offer) return notFound('That listing does not exist on your account.');
    const body = await request.json();
    const price = Number(body?.sellingPricePaise);
    if (!price || price <= 0) return validationFailed({ sellingPricePaise: 'Enter a valid price.' });
    if (price > offer.mrpPaise) return validationFailed({ sellingPricePaise: 'Price cannot exceed MRP.' });
    update('offers', offer.id, { sellingPricePaise: price });
    recomputeBuyBox(offer.variantId);
    scheduleSave();
    return ok(listingRow(findById('offers', offer.id)));
  }),

  mswHttp.patch(`${SELLER_BASE}/listings/:id/stock`, async ({ request, params }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const offer = ownOffer(ctx.user, params.id);
    if (!offer) return notFound('That listing does not exist on your account.');
    const body = await request.json();
    const stock = Math.max(0, Math.floor(Number(body?.stock)));
    if (Number.isNaN(stock)) return validationFailed({ stock: 'Enter a stock quantity.' });
    const product = findById('products', offer.productId);
    const nextStatus = product?.status === 'LIVE' ? (stock > 0 ? 'LIVE' : 'OUT_OF_STOCK') : offer.status;
    update('offers', offer.id, { stock, status: nextStatus });
    recomputeBuyBox(offer.variantId);
    scheduleSave();
    return ok(listingRow(findById('offers', offer.id)));
  }),

  /* ------------------------------------------------------------ resubmit */
  mswHttp.post(`${SELLER_BASE}/listings/:id/resubmit`, async ({ request, params }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const offer = ownOffer(ctx.user, params.id);
    if (!offer) return notFound('That listing does not exist on your account.');
    const product = findById('products', offer.productId);
    if (product.status !== 'NEEDS_CHANGES') {
      return conflict('Only listings that need changes can be resubmitted.', 'NOT_RESUBMITTABLE');
    }
    update('products', product.id, { status: 'QC_PENDING', updatedAt: mockNowIso() });
    submitForQc(findById('products', product.id), ctx.seller, 'RESUBMISSION');
    scheduleSave();
    return ok(listingRow(findById('offers', offer.id)));
  }),

  /* --------------------------------------------------------- bulk upload */
  mswHttp.post(`${SELLER_BASE}/listings/bulk`, async ({ request }) => {
    const ctx = sellerContext(request);
    if (ctx.response) return ctx.response;
    const body = await request.json();
    const inputRows = Array.isArray(body?.rows) ? body.rows : [];
    if (!inputRows.length) return badRequest('No rows to import.', 'EMPTY');

    // Rows sharing a title + category become one product with one variant per row —
    // the CSV equivalent of the Add Product variant matrix.
    const groups = new Map();
    const lineOf = new Map();
    inputRows.forEach((row, i) => {
      const key = `${String(row.title ?? '').trim().toLowerCase()}|${String(row.category ?? '').trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
      lineOf.set(row, i + 1);
    });

    const results = [];
    for (const groupRows of groups.values()) {
      const errors = [];
      const first = groupRows[0];
      const cat = db.categories.find((c) => c.level === 3 && c.name?.toLowerCase() === String(first.category ?? '').toLowerCase());
      if (!first.title) errors.push('Missing title');
      if (!cat) errors.push('Unknown category');

      const variantSpecs = groupRows.map((row) => ({
        row,
        mrp: Math.round(Number(row.mrp) * 100),
        price: Math.round(Number(row.price) * 100),
      }));
      variantSpecs.forEach(({ row, mrp, price }) => {
        const tag = groupRows.length > 1 ? ` (SKU ${row.sku ?? '—'})` : '';
        if (!mrp) errors.push(`Missing MRP${tag}`);
        if (!price) errors.push(`Missing price${tag}`);
        if (price && mrp && price > mrp) errors.push(`Price above MRP${tag}`);
      });

      if (errors.length) {
        for (const row of groupRows) {
          results.push({ line: lineOf.get(row), title: row.title ?? '—', ok: false, errors });
        }
        continue;
      }

      const hasVariantAttrs = groupRows.some((r) => r.colour || r.size);
      const product = insert('products', {
        id: id('FSN', 6),
        title: first.title,
        brandId: null,
        brandName: first.brand ?? null,
        categoryId: cat.id,
        categoryPath: `${cat.rootName} › ${cat.name}`,
        status: 'QC_PENDING',
        description: first.description ?? '',
        highlights: [],
        attributes: {},
        hsnCode: cat.hsnCode,
        gstRate: cat.gstRate,
        countryOfOrigin: 'India',
        returnPolicy: { windowDays: Number(first.returnWindowDays) || cat.returnWindowDays || 7, type: first.returnType || 'RETURN' },
        variantDefiningAttrs: hasVariantAttrs ? ['colour', 'size'].filter((k) => groupRows.some((r) => r[k])) : [],
        images: first.images ? String(first.images).split('|').map((s) => s.trim()).filter(Boolean) : [],
        rating: null,
        ratingCount: 0,
        reviewCount: 0,
        createdAt: mockNowIso(),
        updatedAt: mockNowIso(),
        createdBySellerId: ctx.user.sellerId,
        version: 1,
      });

      variantSpecs.forEach(({ row, mrp, price }, vi) => {
        const attributes = {};
        if (row.colour) attributes.colour = row.colour;
        if (row.size) attributes.size = row.size;
        const variant = insert('variants', {
          id: id('VAR', 6),
          productId: product.id,
          sku: row.sku || `BULK-${product.id}-${vi + 1}`,
          ean: null,
          attributes,
          label: [row.colour, row.size].filter(Boolean).join(' · ') || 'Default',
          images: row.images ? String(row.images).split('|').map((s) => s.trim()).filter(Boolean) : [],
          weightG: Number(row.weightG) || 500,
          dimsCm: { l: Number(row.dimsL) || 20, w: Number(row.dimsW) || 15, h: Number(row.dimsH) || 5 },
          status: 'ACTIVE',
          version: 1,
        });
        insert('offers', {
          id: id('OFR', 7),
          productId: product.id,
          variantId: variant.id,
          sellerId: ctx.user.sellerId,
          sellerName: ctx.seller?.storeName ?? '—',
          sellingPricePaise: price,
          mrpPaise: mrp,
          stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
          fulfillmentType: 'SELLER',
          dispatchSlaHours: 48,
          status: 'QC_PENDING',
          buyBoxWinner: false,
          ariseAssured: false,
          version: 1,
        });
      });
      submitForQc(product, ctx.seller, 'NEW');
      for (const row of groupRows) results.push({ line: lineOf.get(row), title: row.title, ok: true });
    }
    results.sort((a, b) => a.line - b.line);

    scheduleSave();
    return created({
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  }),
];
