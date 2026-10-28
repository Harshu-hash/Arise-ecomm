import { http as mswHttp } from 'msw';
import { db, filter, findById, id, insert, remove, update } from '../db/store';
import { diffOf, writeAudit } from '../engine/audit';
import { guard } from '../engine/guard';
import { listResult, parseListQuery } from '../engine/list';
import {
  conflict,
  created,
  notFound,
  ok,
  okList,
  validationFailed,
  versionConflict,
} from '../engine/respond';
import { mockNowIso } from '../engine/settings';
import { scheduleSave } from '../persistence';

const BASE = '/api/admin/v1';

/** Category scope: a Category Manager only sees their assigned roots. */
function categoryAllowed(category, user) {
  const scope = user.scope?.categories;
  if (!scope?.length) return true;
  // Scope is held at the root level; walk up to find the ancestor.
  let node = category;
  while (node) {
    if (scope.includes(node.id)) return true;
    node = node.parentId ? findById('categories', node.parentId) : null;
  }
  return false;
}

function descendantsOf(categoryId) {
  const out = [];
  const walk = (parentId) => {
    for (const c of db.categories.filter((x) => x.parentId === parentId)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(categoryId);
  return out;
}

/** Re-derives each attribute's usedInCategories count after a set or category changes. */
function recomputeAttributeUsage() {
  for (const attribute of db.attributes) {
    attribute.usedInCategories = db.categories.filter(
      (c) => c.attributeSetId && findById('attributeSets', c.attributeSetId)?.attributeIds.includes(attribute.id),
    ).length;
  }
}

export const catalogMasterHandlers = [
  /* ----------------------------------------------------------- categories */
  mswHttp.get(`${BASE}/categories`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.category.view');
    if (g.response) return g.response;

    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: 'name', defaultPageSize: 100 });
    const rows = db.categories.filter((c) => categoryAllowed(c, g.user));

    const { items, meta } = listResult(rows, query, {
      searchFields: ['name', 'id', 'rootName'],
      filterSpec: {
        level: 'level',
        status: 'status',
        rootName: 'rootName',
        gated: { path: 'gated', kind: 'boolean' },
        parentId: 'parentId',
      },
      sortable: ['name', 'level', 'liveListings', 'sortOrder'],
      facetFields: ['level', 'status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${BASE}/categories/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.category.view');
    if (g.response) return g.response;

    const category = findById('categories', params.id);
    if (!category) return notFound('That category no longer exists.');
    if (!categoryAllowed(category, g.user)) {
      return conflict('This category is outside the ones assigned to you.', 'OUT_OF_SCOPE');
    }

    const set = category.attributeSetId ? findById('attributeSets', category.attributeSetId) : null;
    const ancestors = [];
    let node = category.parentId ? findById('categories', category.parentId) : null;
    while (node) {
      ancestors.unshift({ id: node.id, name: node.name });
      node = node.parentId ? findById('categories', node.parentId) : null;
    }

    return ok(category, {
      ancestors,
      childCount: db.categories.filter((c) => c.parentId === category.id).length,
      attributeSet: set,
      attributes: (set?.attributeIds ?? []).map((aid) => findById('attributes', aid)).filter(Boolean),
      sizeCharts: filter('sizeCharts', (s) => s.categoryId === category.id),
      allowedActions: ['EDIT', ...(descendantsOf(category.id).length === 0 && category.liveListings === 0 ? ['DELETE'] : [])],
    });
  }),

  mswHttp.post(`${BASE}/categories`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.category.create');
    if (g.response) return g.response;

    const body = await request.json();
    const fieldErrors = {};
    if (!String(body?.name ?? '').trim()) fieldErrors.name = 'Give the category a name.';
    const parent = body?.parentId ? findById('categories', body.parentId) : null;
    if (body?.parentId && !parent) fieldErrors.parentId = 'That parent no longer exists.';
    if (parent && parent.level >= 3) fieldErrors.parentId = 'The taxonomy is three levels deep.';

    const level = parent ? parent.level + 1 : 1;
    const siblings = db.categories.filter((c) => c.parentId === (body?.parentId ?? null));
    if (siblings.some((c) => c.name.toLowerCase() === String(body?.name ?? '').trim().toLowerCase())) {
      fieldErrors.name = 'A sibling category already has this name.';
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const row = insert('categories', {
      id: id('CAT', 4),
      name: String(body.name).trim(),
      slug: String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      parentId: body.parentId ?? null,
      level,
      rootName: parent ? parent.rootName : String(body.name).trim(),
      sortOrder: siblings.length + 1,
      status: 'ACTIVE',
      returnWindowDays: body.returnWindowDays ?? parent?.returnWindowDays ?? 7,
      returnTypes: body.returnTypes ?? parent?.returnTypes ?? ['REFUND', 'REPLACEMENT'],
      gated: Boolean(body.gated),
      codAllowed: body.codAllowed !== false,
      assuredEligible: level === 3,
      gstRate: body.gstRate ?? parent?.gstRate ?? 18,
      hsnCode: body.hsnCode ?? parent?.hsnCode ?? null,
      attributeSetId: body.attributeSetId ?? parent?.attributeSetId ?? null,
      liveListings: 0,
      version: 1,
    });
    writeAudit({
      actor: g.user,
      action: 'catalog.category.create',
      entityType: 'category',
      entityId: row.id,
      entityLabel: row.name,
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.patch(`${BASE}/categories/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.category.edit');
    if (g.response) return g.response;

    const category = findById('categories', params.id);
    if (!category) return notFound('That category no longer exists.');
    if (!categoryAllowed(category, g.user)) {
      return conflict('This category is outside the ones assigned to you.', 'OUT_OF_SCOPE');
    }
    const body = await request.json();
    if (body.version !== undefined && body.version !== category.version) return versionConflict(category);

    // Hiding a category with live listings takes the listings down with it,
    // so it has to be a deliberate choice rather than a side effect.
    if (body.status === 'HIDDEN' && category.liveListings > 0 && !body.hideListings) {
      return conflict(
        `${category.liveListings} live listings sit in this category. Confirm that hiding it should take them down too.`,
        'CATEGORY_HAS_LISTINGS',
        { details: { liveListings: category.liveListings } },
      );
    }

    const before = { ...category };
    const patch = {};
    for (const key of [
      'name', 'status', 'sortOrder', 'returnWindowDays', 'returnTypes', 'gated',
      'codAllowed', 'gstRate', 'hsnCode', 'attributeSetId', 'assuredEligible',
    ]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    update('categories', category.id, patch);
    if ('attributeSetId' in patch) recomputeAttributeUsage();

    writeAudit({
      actor: g.user,
      action: 'catalog.category.edit',
      entityType: 'category',
      entityId: category.id,
      entityLabel: category.name,
      changes: diffOf(before, findById('categories', category.id)),
      reason: body.reason ?? null,
    });
    scheduleSave();
    return ok(findById('categories', category.id));
  }),

  mswHttp.delete(`${BASE}/categories/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.category.delete');
    if (g.response) return g.response;

    const category = findById('categories', params.id);
    if (!category) return notFound('That category no longer exists.');
    if (descendantsOf(category.id).length) {
      return conflict('Move or delete the child categories first.', 'CATEGORY_HAS_CHILDREN');
    }
    if (db.products.some((p) => p.categoryId === category.id)) {
      return conflict('Products still sit in this category.', 'CATEGORY_HAS_PRODUCTS');
    }

    remove('categories', category.id);
    writeAudit({
      actor: g.user,
      action: 'catalog.category.delete',
      entityType: 'category',
      entityId: category.id,
      entityLabel: category.name,
      severity: 'warning',
    });
    scheduleSave();
    return ok({ ok: true });
  }),

  /* ----------------------------------------------------------- attributes */
  mswHttp.get(`${BASE}/attributes`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.view');
    if (g.response) return g.response;

    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: 'name', defaultPageSize: 50 });
    const { items, meta } = listResult(db.attributes, query, {
      searchFields: ['name', 'code'],
      filterSpec: {
        type: 'type',
        filterable: { path: 'filterable', kind: 'boolean' },
        variantDefining: { path: 'variantDefining', kind: 'boolean' },
      },
      sortable: ['name', 'code', 'type', 'usedInCategories'],
      facetFields: ['type'],
    });
    return okList(items, { ...meta, sets: db.attributeSets });
  }),

  mswHttp.patch(`${BASE}/attributes/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.edit');
    if (g.response) return g.response;

    const attribute = findById('attributes', params.id);
    if (!attribute) return notFound('That attribute no longer exists.');
    const body = await request.json();

    // Changing the type of an attribute already in use would invalidate every
    // value stored against it.
    if (body.type && body.type !== attribute.type && attribute.usedInCategories > 0) {
      return conflict(
        `This attribute is used by ${attribute.usedInCategories} categories, so its type cannot change.`,
        'ATTRIBUTE_IN_USE',
      );
    }

    const before = { ...attribute };
    const patch = {};
    for (const key of ['name', 'unit', 'filterable', 'variantDefining', 'values', 'type']) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    update('attributes', attribute.id, patch);
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.edit',
      entityType: 'attribute',
      entityId: attribute.id,
      entityLabel: attribute.name,
      changes: diffOf(before, findById('attributes', attribute.id)),
    });
    scheduleSave();
    return ok(findById('attributes', attribute.id));
  }),

  mswHttp.post(`${BASE}/attributes`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.create');
    if (g.response) return g.response;

    const body = await request.json();
    const fieldErrors = {};
    if (!String(body?.name ?? '').trim()) fieldErrors.name = 'Give the attribute a name.';
    if (!String(body?.code ?? '').trim()) fieldErrors.code = 'Give the attribute a code.';
    if (db.attributes.some((a) => a.code === String(body?.code ?? '').trim())) {
      fieldErrors.code = 'An attribute with this code already exists.';
    }
    if (!body?.type) fieldErrors.type = 'Choose a type.';
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const row = insert('attributes', {
      id: id('ATR', 4),
      name: String(body.name).trim(),
      code: String(body.code).trim(),
      type: body.type,
      unit: body.unit ?? null,
      filterable: Boolean(body.filterable),
      variantDefining: Boolean(body.variantDefining),
      values: (body.values ?? []).map((v) => ({ value: v, active: true, synonyms: [] })),
      usedInCategories: 0,
      createdAt: mockNowIso(),
      version: 1,
    });
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.create',
      entityType: 'attribute',
      entityId: row.id,
      entityLabel: row.name,
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.delete(`${BASE}/attributes/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.delete');
    if (g.response) return g.response;

    const attribute = findById('attributes', params.id);
    if (!attribute) return notFound('That attribute no longer exists.');
    if (attribute.usedInCategories > 0) {
      return conflict(`This attribute is used by ${attribute.usedInCategories} categories and cannot be deleted.`, 'ATTRIBUTE_IN_USE');
    }
    if (db.attributeSets.some((s) => s.attributeIds.includes(attribute.id))) {
      return conflict('Remove this attribute from its attribute sets first.', 'ATTRIBUTE_IN_SET');
    }

    remove('attributes', attribute.id);
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.delete',
      entityType: 'attribute',
      entityId: attribute.id,
      entityLabel: attribute.name,
      severity: 'warning',
    });
    scheduleSave();
    return ok({ ok: true });
  }),

  /* ------------------------------------------------------------- attribute sets */
  mswHttp.post(`${BASE}/attribute-sets`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.create');
    if (g.response) return g.response;

    const body = await request.json();
    const fieldErrors = {};
    if (!String(body?.name ?? '').trim()) fieldErrors.name = 'Give the set a name.';
    if (!Array.isArray(body?.attributeIds) || !body.attributeIds.length) {
      fieldErrors.attributeIds = 'Pick at least one attribute.';
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const row = insert('attributeSets', {
      id: id('ATS', 3),
      name: String(body.name).trim(),
      rootName: body.rootName ?? null,
      attributeIds: body.attributeIds,
      version: 1,
    });
    recomputeAttributeUsage();
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.create',
      entityType: 'attributeSet',
      entityId: row.id,
      entityLabel: row.name,
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.patch(`${BASE}/attribute-sets/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.edit');
    if (g.response) return g.response;

    const set = findById('attributeSets', params.id);
    if (!set) return notFound('That attribute set no longer exists.');
    const body = await request.json();
    const before = { ...set };

    const patch = {};
    for (const key of ['name', 'rootName', 'attributeIds']) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    update('attributeSets', set.id, patch);
    recomputeAttributeUsage();
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.edit',
      entityType: 'attributeSet',
      entityId: set.id,
      entityLabel: set.name,
      changes: diffOf(before, findById('attributeSets', set.id)),
    });
    scheduleSave();
    return ok(findById('attributeSets', set.id));
  }),

  mswHttp.delete(`${BASE}/attribute-sets/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.attribute.delete');
    if (g.response) return g.response;

    const set = findById('attributeSets', params.id);
    if (!set) return notFound('That attribute set no longer exists.');
    const usedBy = db.categories.filter((c) => c.attributeSetId === set.id).length;
    if (usedBy > 0) {
      return conflict(`${usedBy} categories use this set and must be reassigned first.`, 'ATTRIBUTE_SET_IN_USE');
    }

    remove('attributeSets', set.id);
    writeAudit({
      actor: g.user,
      action: 'catalog.attribute.delete',
      entityType: 'attributeSet',
      entityId: set.id,
      entityLabel: set.name,
      severity: 'warning',
    });
    scheduleSave();
    return ok({ ok: true });
  }),

  /* --------------------------------------------------------------- brands */
  mswHttp.get(`${BASE}/brands`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.brand.view');
    if (g.response) return g.response;

    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: 'name', defaultPageSize: 50 });
    const rows = db.brands.map((b) => ({
      ...b,
      pendingRequests: db.brandRequests.filter((r) => r.brandId === b.id && r.status === 'PENDING').length,
      productCount: db.products.filter((p) => p.brandId === b.id).length,
    }));

    const { items, meta } = listResult(rows, query, {
      searchFields: ['name', 'id'],
      filterSpec: {
        status: 'status',
        gated: { path: 'gated', kind: 'boolean' },
        rootCategory: 'rootCategory',
        ownerType: 'ownerType',
      },
      sortable: ['name', 'status', 'productCount', 'authorisedSellerCount'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.patch(`${BASE}/brands/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.brand.edit');
    if (g.response) return g.response;

    const brand = findById('brands', params.id);
    if (!brand) return notFound('That brand no longer exists.');
    const body = await request.json();
    const before = { ...brand };

    const patch = {};
    for (const key of ['name', 'gated', 'ownerType', 'status']) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    update('brands', brand.id, patch);
    writeAudit({
      actor: g.user,
      action: 'catalog.brand.edit',
      entityType: 'brand',
      entityId: brand.id,
      entityLabel: brand.name,
      changes: diffOf(before, findById('brands', brand.id)),
    });
    scheduleSave();
    return ok(findById('brands', brand.id));
  }),

  mswHttp.post(`${BASE}/brands`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.brand.create');
    if (g.response) return g.response;

    const body = await request.json();
    const fieldErrors = {};
    if (!String(body?.name ?? '').trim()) fieldErrors.name = 'Give the brand a name.';
    if (db.brands.some((b) => b.name.toLowerCase() === String(body?.name ?? '').trim().toLowerCase())) {
      fieldErrors.name = 'A brand with this name already exists.';
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const row = insert('brands', {
      id: id('BRD', 3),
      name: String(body.name).trim(),
      gated: Boolean(body.gated),
      ownerType: body.ownerType ?? 'BRAND_OWNER',
      status: body.status ?? 'VERIFIED',
      rootCategory: body.rootCategory ?? null,
      authorisedSellerCount: 0,
      listings: 0,
      createdAt: mockNowIso(),
      version: 1,
    });
    writeAudit({
      actor: g.user,
      action: 'catalog.brand.create',
      entityType: 'brand',
      entityId: row.id,
      entityLabel: row.name,
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.delete(`${BASE}/brands/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.brand.delete');
    if (g.response) return g.response;

    const brand = findById('brands', params.id);
    if (!brand) return notFound('That brand no longer exists.');
    if (db.products.some((p) => p.brandId === brand.id)) {
      return conflict('Products still carry this brand and it cannot be deleted.', 'BRAND_IN_USE');
    }

    remove('brands', brand.id);
    writeAudit({
      actor: g.user,
      action: 'catalog.brand.delete',
      entityType: 'brand',
      entityId: brand.id,
      entityLabel: brand.name,
      severity: 'warning',
    });
    scheduleSave();
    return ok({ ok: true });
  }),

  /* ------------------------------------------------------------ HSN codes */
  mswHttp.get(`${BASE}/hsn-codes`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.hsn.view');
    if (g.response) return g.response;

    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: 'code', defaultPageSize: 50 });
    const rows = db.hsnCodes.map((h) => ({
      ...h,
      categoryCount: db.categories.filter((c) => c.hsnCode === h.code).length,
    }));
    const { items, meta } = listResult(rows, query, {
      searchFields: ['code', 'description'],
      filterSpec: { gstRate: 'gstRate', rootName: 'rootName' },
      sortable: ['code', 'gstRate', 'categoryCount'],
      facetFields: ['gstRate'],
    });
    return okList(items, meta);
  }),

  mswHttp.post(`${BASE}/hsn-codes`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.hsn.create');
    if (g.response) return g.response;

    const body = await request.json();
    const fieldErrors = {};
    if (!String(body?.code ?? '').trim()) fieldErrors.code = 'Give the code.';
    if (db.hsnCodes.some((h) => h.code === String(body?.code ?? '').trim())) {
      fieldErrors.code = 'This HSN code already exists.';
    }
    if (!String(body?.description ?? '').trim()) fieldErrors.description = 'Describe what this code covers.';
    if (body?.gstRate === undefined || body?.gstRate === null) fieldErrors.gstRate = 'Choose a GST rate.';
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const row = insert('hsnCodes', {
      id: id('HSN', 4),
      code: String(body.code).trim(),
      description: String(body.description).trim(),
      gstRate: body.gstRate,
      cess: body.cess ?? 0,
      effectiveFrom: body.effectiveFrom ?? mockNowIso(),
      rootName: body.rootName ?? null,
      version: 1,
    });
    writeAudit({
      actor: g.user,
      action: 'catalog.hsn.create',
      entityType: 'hsnCode',
      entityId: row.id,
      entityLabel: row.code,
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.patch(`${BASE}/hsn-codes/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.hsn.edit');
    if (g.response) return g.response;

    const hsn = findById('hsnCodes', params.id);
    if (!hsn) return notFound('That HSN code no longer exists.');
    const body = await request.json();
    const before = { ...hsn };

    const patch = {};
    for (const key of ['description', 'gstRate', 'cess', 'effectiveFrom', 'rootName']) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    update('hsnCodes', hsn.id, patch);
    writeAudit({
      actor: g.user,
      action: 'catalog.hsn.edit',
      entityType: 'hsnCode',
      entityId: hsn.id,
      entityLabel: hsn.code,
      changes: diffOf(before, findById('hsnCodes', hsn.id)),
      reason: body.reason ?? null,
    });
    scheduleSave();
    return ok(findById('hsnCodes', hsn.id));
  }),

  /* ---------------------------------------------------------- size charts */
  mswHttp.get(`${BASE}/size-charts`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'catalog.sizechart.view');
    if (g.response) return g.response;

    const rows = db.sizeCharts.map((s) => ({
      ...s,
      categoryName: s.categoryId ? findById('categories', s.categoryId)?.name : null,
      productCount: db.products.filter((p) => p.sizeChartId === s.id).length,
    }));
    return ok(rows);
  }),

  mswHttp.patch(`${BASE}/size-charts/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'catalog.sizechart.edit');
    if (g.response) return g.response;

    const chart = findById('sizeCharts', params.id);
    if (!chart) return notFound('That size chart no longer exists.');
    const body = await request.json();

    if (body.rows && body.columns && body.rows.some((r) => r.length !== body.columns.length)) {
      return validationFailed({ rows: 'Every row must have one value per column.' });
    }
    const before = { ...chart };
    update('sizeCharts', chart.id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.columns !== undefined ? { columns: body.columns } : {}),
      ...(body.rows !== undefined ? { rows: body.rows } : {}),
      updatedAt: mockNowIso(),
    });
    writeAudit({
      actor: g.user,
      action: 'catalog.sizechart.edit',
      entityType: 'sizeChart',
      entityId: chart.id,
      entityLabel: chart.name,
      changes: diffOf(before, findById('sizeCharts', chart.id)),
    });
    scheduleSave();
    return ok(findById('sizeCharts', chart.id));
  }),
];
