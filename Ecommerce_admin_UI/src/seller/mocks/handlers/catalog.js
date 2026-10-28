import { http as mswHttp } from 'msw';
import { db, filter, find, findById, id, insert } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

function auth(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user };
}

export const sellerCatalogHandlers = [
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
