import { http as mswHttp } from 'msw';
import { db, filter, find, findById, id, insert } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { recomputeBuyBox } from '@seller/mocks/engine/sellerCatalog';
import { SELLER_BASE } from './auth';

function auth(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user };
}

export const sellerCatalogHandlers = [
  mswHttp.get(`${SELLER_BASE}/catalog/search`, ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim().toLowerCase();
    const brandId = url.searchParams.get('brandId');
    const categoryId = url.searchParams.get('categoryId');
    const rows = db.products.filter((product) => {
      if (product.status !== 'LIVE') return false;
      if (brandId && product.brandId !== brandId) return false;
      if (categoryId && product.categoryId !== categoryId) return false;
      if (!q) return true;
      const variants = filter('variants', (variant) => variant.productId === product.id);
      return [product.id, product.productCode, product.title, product.brandName, ...variants.flatMap((variant) => [variant.ean, variant.sku])]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    }).slice(0, 30).map((product) => {
      const variants = filter('variants', (variant) => variant.productId === product.id);
      const liveOffers = filter('offers', (offer) => offer.productId === product.id && ['LIVE', 'OUT_OF_STOCK'].includes(offer.status));
      const ownOffers = liveOffers.filter((offer) => offer.sellerId === a.user.sellerId);
      return {
        id: product.id, title: product.title, brandName: product.brandName,
        categoryPath: product.categoryPath, image: product.images?.[0] ?? null,
        variantCount: variants.length, alreadySelling: ownOffers.length > 0,
        minPricePaise: liveOffers.length ? Math.min(...liveOffers.map((offer) => offer.sellingPricePaise)) : null,
      };
    });
    return ok(rows);
  }),

  mswHttp.get(`${SELLER_BASE}/catalog/products/:id`, ({ request, params }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const product = findById('products', params.id);
    if (!product || product.status !== 'LIVE') return notFound('That catalogue product is not available to sell.');
    const variants = filter('variants', (variant) => variant.productId === product.id && variant.status === 'ACTIVE').map((variant) => {
      const offers = filter('offers', (offer) => offer.variantId === variant.id && ['LIVE', 'OUT_OF_STOCK'].includes(offer.status));
      const winner = offers.find((offer) => offer.buyBoxWinner);
      return { ...variant, buyBoxPricePaise: winner?.sellingPricePaise ?? null, offerCount: offers.length, alreadySelling: offers.some((offer) => offer.sellerId === a.user.sellerId) };
    });
    return ok({ product, variants });
  }),

  mswHttp.post(`${SELLER_BASE}/catalog/products/:id/offers`, async ({ request, params }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const product = findById('products', params.id);
    if (!product || product.status !== 'LIVE') return notFound('That catalogue product is not available to sell.');
    const body = await request.json();
    const specs = Array.isArray(body?.offers) ? body.offers : [];
    if (!specs.length) return badRequest('Choose at least one variant.', 'NO_VARIANTS');
    const seller = sellerFor(a.user) ?? findById('sellers', a.user.sellerId);
    const createdOffers = [];
    for (const spec of specs) {
      const variant = findById('variants', spec.variantId);
      if (!variant || variant.productId !== product.id) return badRequest('A selected variant does not belong to this product.', 'BAD_VARIANT');
      if (find('offers', (offer) => offer.variantId === variant.id && offer.sellerId === a.user.sellerId && offer.status !== 'DELETED')) return conflict(`You already sell ${variant.label}.`, 'OFFER_EXISTS');
      const price = Number(spec.sellingPricePaise);
      const mrp = Number(spec.mrpPaise);
      if (!(price > 0) || !(mrp > 0) || price > mrp) return badRequest(`Check the price and MRP for ${variant.label}.`, 'PRICE_INVALID');
      const offer = insert('offers', {
        id: id('OFR', 7), productId: product.id, variantId: variant.id,
        sellerId: a.user.sellerId, sellerName: seller?.storeName ?? '—',
        sellerSku: spec.sellerSku, barcode: spec.barcode ?? variant.ean ?? null,
        sellingPricePaise: price, mrpPaise: mrp, compareAtPaise: Number(spec.compareAtPaise) || null,
        stock: Math.max(0, Math.floor(Number(spec.stock) || 0)),
        fulfillmentType: body.fulfillmentType === 'ARISE' ? 'ARISE' : 'SELLER',
        dispatchSlaHours: 48, status: Number(spec.stock) > 0 ? 'LIVE' : 'OUT_OF_STOCK',
        taxCode: spec.taxCode ?? product.hsnCode, scheduledPrice: null,
        buyBoxWinner: false, ariseAssured: false, createdAt: mockNowIso(), updatedAt: mockNowIso(), version: 1,
      });
      recomputeBuyBox(variant.id);
      createdOffers.push(offer);
    }
    scheduleSave();
    return created({ productId: product.id, offers: createdOffers });
  }),

  /* Leaf categories a seller can list under. */
  mswHttp.get(`${SELLER_BASE}/catalog/categories`, ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const rows = db.categories
      .filter((c) => c.level === 3 && c.status === 'ACTIVE')
      .map((c) => ({
        id: c.id,
        name: c.name,
        rootName: c.rootName,
        path: `${c.rootName} › ${c.name}`,
        gstRate: c.gstRate,
        hsnCode: c.hsnCode,
        gated: c.gated,
        attributeSetId: c.attributeSetId ?? null,
      }));
    return ok(rows);
  }),

  /* The attribute set + size charts for one category (drives the add form). */
  mswHttp.get(`${SELLER_BASE}/catalog/categories/:id/attributes`, ({ request, params }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const category = findById('categories', params.id);
    if (!category) return notFound('Category not found.');
    const set = category.attributeSetId ? findById('attributeSets', category.attributeSetId) : null;
    const attributes = (set?.attributeIds ?? []).map((aid) => findById('attributes', aid)).filter(Boolean);
    const sizeCharts = filter('sizeCharts', (s) => s.categoryId === category.id);
    return ok({ category: { id: category.id, name: category.name, gated: category.gated }, attributes, sizeCharts });
  }),

  /* Brands, for the listing form and brand requests. */
  mswHttp.get(`${SELLER_BASE}/catalog/brands`, ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const rows = db.brands.map((b) => ({ id: b.id, name: b.name, status: b.status, gated: b.gated, rootCategory: b.rootCategory }));
    return ok(rows);
  }),

  /* HSN & tax codes reference. */
  mswHttp.get(`${SELLER_BASE}/catalog/hsn`, ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    return ok(db.hsnCodes);
  }),

  /* ------------------------------------------------------- brand requests */
  mswHttp.get(`${SELLER_BASE}/brand-requests`, ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-submittedAt' });
    const rows = filter('brandRequests', (r) => r.sellerId === a.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['brandName', 'id'],
      filterSpec: { status: 'status' },
      sortable: ['submittedAt', 'brandName', 'status'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.post(`${SELLER_BASE}/brand-requests`, async ({ request }) => {
    const a = auth(request);
    if (a.response) return a.response;
    const body = await request.json();
    const seller = sellerFor(a.user) ?? findById('sellers', a.user.sellerId);
    const brand = body?.brandId ? findById('brands', body.brandId) : null;
    const brandName = brand?.name ?? body?.brandName;
    if (!brandName) return badRequest('Choose a brand or enter a new brand name.', 'NO_BRAND');

    const dup = find('brandRequests', (r) => r.sellerId === a.user.sellerId && r.brandName === brandName && ['PENDING', 'UNDER_REVIEW'].includes(r.status));
    if (dup) return conflict('You already have an open request for this brand.', 'DUPLICATE_REQUEST');

    const row = insert('brandRequests', {
      id: id('BRQ', 6),
      sellerId: a.user.sellerId,
      sellerName: seller?.storeName ?? '—',
      brandId: brand?.id ?? null,
      brandName,
      requestType: body?.requestType ?? (brand ? 'AUTHORISATION' : 'NEW_BRAND'),
      documents: Array.isArray(body?.documents) ? body.documents : [],
      note: body?.note ?? null,
      submittedAt: mockNowIso(),
      status: 'PENDING',
      validTill: null,
      decisionReason: null,
      version: 1,
    });
    scheduleSave();
    return created(row);
  }),
];
