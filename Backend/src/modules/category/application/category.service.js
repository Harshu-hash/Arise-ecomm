import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import {
  attributeSetDetails,
  releaseAttributeSet,
  reserveAttributeSet,
} from '../../attribute/public/index.js';
import {
  MAX_CATEGORY_LEVEL,
  categoryNameKey,
  categorySlug,
  categoryTree,
  inheritedCategoryValues,
} from '../domain/services/categoryRules.js';
import { Category } from '../infrastructure/persistence/category.model.js';

const HEX_COLOR = /^#[\da-f]{6}$/i;

const id = (value) => (value ? String(value) : null);

export function serializeCategory(row, rootName = null) {
  return {
    id: id(row._id),
    name: row.name,
    slug: row.slug,
    parentId: id(row.parentId),
    level: row.level,
    rootName: rootName ?? (row.level === 1 ? row.name : null),
    sortOrder: row.sortOrder,
    status: row.status,
    returnWindowDays: row.returnWindowDays,
    returnTypes: row.returnTypes,
    gated: row.gated,
    codAllowed: row.codAllowed,
    gstRate: row.gstRate,
    commissionPct: row.commissionPct ?? null,
    hsnCode: row.hsnCode ?? null,
    attributeSetId: id(row.attributeSetId),
    imageUrl: row.imageUrl ?? null,
    icon: row.icon ?? null,
    color: row.level === 1 ? row.color ?? null : undefined,
    liveListings: row.liveListings,
    version: row.version,
  };
}

function scopeRootIds(scope) {
  if (!Array.isArray(scope?.categories)) return null;
  return scope.categories.filter((value) => mongoose.isValidObjectId(value)).map(String);
}

function assertInScope(category, scope) {
  const roots = scopeRootIds(scope);
  if (roots && !roots.includes(id(category.rootId))) throw new NotFoundError('Category not found.');
}

async function rootNameFor(category) {
  if (category.level === 1) return category.name;
  return (await Category.findById(category.rootId, 'name').lean())?.name ?? null;
}

async function subtree(categoryId) {
  const ids = [String(categoryId)];
  let parents = [categoryId];
  while (parents.length) {
    const rows = await Category.find({ parentId: { $in: parents } }, '_id').lean();
    parents = rows.map((row) => row._id);
    ids.push(...parents.map(String));
  }
  return ids;
}

function duplicateNameError(error) {
  if (error?.code !== 11000) return error;
  return new ValidationError('A sibling category already has this name.', {
    name: ['A sibling category already has this name.'],
  });
}

export async function listCategoryTree(scope) {
  const roots = scopeRootIds(scope);
  const filter = roots ? { rootId: { $in: roots } } : {};
  const rows = await Category.find(filter).lean();
  const rootNames = new Map(rows.filter((row) => row.level === 1).map((row) => [id(row._id), row.name]));
  return categoryTree(rows, (row) => serializeCategory(row, rootNames.get(id(row.rootId))));
}

export async function findRootCategoryByName(name) {
  const category = await Category.findOne({ level: 1, nameKey: categoryNameKey(name) }, 'name').lean();
  return category ? { id: String(category._id), name: category.name } : null;
}

export async function findCategoryForCatalog(categoryId) {
  const category = await Category.findById(categoryId, 'name rootId').lean();
  return category ? {
    id: String(category._id),
    name: category.name,
    rootId: String(category.rootId),
  } : null;
}

/** A leaf category as a new product/listing needs it: policy snapshot plus its breadcrumb path. */
/**
 * The commission that applies given a category and its ancestors (nearest first): the bottom-most one with a rate set
 * wins, and `source` says which. No rate anywhere up the tree means 0% from no category.
 */
function effectiveCommission(chain) {
  const node = chain.find((row) => row.commissionPct != null);
  return node ? { pct: node.commissionPct, source: { id: id(node._id), name: node.name } } : { pct: 0, source: null };
}

export async function getCategoryForListing(categoryId) {
  const category = await Category.findOne({ _id: categoryId, level: MAX_CATEGORY_LEVEL, status: 'ACTIVE' }).lean();
  if (!category) return null;
  const names = [category.name];
  const chain = [category];
  let parent = category.parentId ? await Category.findById(category.parentId, 'name parentId commissionPct').lean() : null;
  while (parent) {
    names.unshift(parent.name);
    chain.push(parent);
    parent = parent.parentId ? await Category.findById(parent.parentId, 'name parentId commissionPct').lean() : null;
  }
  return {
    id: id(category._id),
    name: category.name,
    path: names.join(' › '),
    rootId: id(category.rootId),
    attributeSetId: id(category.attributeSetId),
    hsnCode: category.hsnCode,
    gstRate: category.gstRate,
    commissionPct: effectiveCommission(chain).pct,
    returnWindowDays: category.returnWindowDays,
    returnTypes: category.returnTypes,
    gated: category.gated,
  };
}

/** Keeps `canDelete`/hide-impact checks honest once products start using this category. */
export async function incrementCategoryProductCount(categoryId, delta) {
  if (!categoryId || !delta) return;
  await Category.updateOne({ _id: categoryId }, { $inc: { productCount: delta } });
}

export async function getCategory(categoryId, scope) {
  const category = await Category.findById(categoryId).lean();
  if (!category) throw new NotFoundError('Category not found.');
  assertInScope(category, scope);

  const ancestors = [];
  const above = []; // nearest first, with the fields the commission lookup needs
  let parentId = category.parentId;
  while (parentId) {
    const parent = await Category.findById(parentId, 'name parentId commissionPct').lean();
    if (!parent) break;
    ancestors.unshift({ id: id(parent._id), name: parent.name });
    above.push(parent);
    parentId = parent.parentId;
  }
  const [childCount, descendantIds] = await Promise.all([
    Category.countDocuments({ parentId: category._id }),
    subtree(category._id),
  ]);
  const descendantStats = await Category.aggregate([
    { $match: { _id: { $in: descendantIds.map((value) => new mongoose.Types.ObjectId(value)) } } },
    { $group: { _id: null, liveListings: { $sum: '$liveListings' }, productCount: { $sum: '$productCount' } } },
  ]);
  const stats = descendantStats[0] ?? { liveListings: 0, productCount: 0 };
  const attributeDetails = await attributeSetDetails(category.attributeSetId);

  return {
    data: serializeCategory(category, await rootNameFor(category)),
    meta: {
      ancestors,
      // What this category would use if it had no rate of its own, so the editor can show it.
      inheritedCommission: effectiveCommission(above),
      childCount,
      liveListingsInSubtree: stats.liveListings,
      canDelete: childCount === 0 && stats.liveListings === 0 && stats.productCount === 0,
      ...attributeDetails,
      sizeCharts: [],
    },
  };
}

export async function createCategory(input, { scope, actor, canEditCommission = false }) {
  if (input.commissionPct != null && !canEditCommission) {
    throw new ForbiddenError('Setting a commission rate needs the "Commission & fees: edit rules" permission.');
  }
  const parent = input.parentId ? await Category.findById(input.parentId).lean() : null;
  if (input.parentId && !parent) throw new ValidationError('Parent category not found.', { parentId: ['Parent category not found.'] });
  if (parent) assertInScope(parent, scope);
  if (!parent && scopeRootIds(scope)) throw new ValidationError('Scoped admins cannot create top-level categories.');

  const level = parent ? parent.level + 1 : 1;
  if (level > MAX_CATEGORY_LEVEL) {
    throw new ValidationError('The taxonomy is limited to three levels.', { parentId: ['The taxonomy is limited to three levels.'] });
  }
  if (level > 1 && input.color != null) {
    throw new ValidationError('Only top-level categories can have a colour.', { color: ['Only top-level categories can have a colour.'] });
  }
  if (input.color != null && !HEX_COLOR.test(input.color)) {
    throw new ValidationError('Choose a valid colour.', { color: ['Choose a valid six-digit hex colour.'] });
  }
  if (level < MAX_CATEGORY_LEVEL && input.attributeSetId) {
    throw new ValidationError('Only level-three categories can have an attribute set.', {
      attributeSetId: ['Only level-three categories can have an attribute set.'],
    });
  }

  const _id = new mongoose.Types.ObjectId();
  const sibling = await Category.findOne({ parentId: parent?._id ?? null }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const values = inheritedCategoryValues(parent, input);
  const rootName = parent ? await rootNameFor(parent) : input.name;
  if (values.attributeSetId) await reserveAttributeSet(values.attributeSetId, {
    rootId: parent?.rootId ?? _id,
    rootName,
  });
  const row = new Category({
    _id,
    name: input.name,
    nameKey: categoryNameKey(input.name),
    slug: categorySlug(input.name),
    parentId: parent?._id ?? null,
    rootId: parent?.rootId ?? _id,
    level,
    sortOrder: (sibling?.sortOrder ?? 0) + 1,
    status: 'ACTIVE',
    ...values,
    imageUrl: input.imageUrl ?? null,
    icon: input.icon ?? null,
    color: level === 1 ? input.color ?? null : null,
  });

  try {
    await row.save();
  } catch (error) {
    if (values.attributeSetId) await releaseAttributeSet(values.attributeSetId);
    throw duplicateNameError(error);
  }
  const result = serializeCategory(row.toObject(), rootName);
  await recordAudit({
    action: 'catalog.category.create',
    subjectType: 'category',
    subjectId: row._id,
    after: result,
    actor,
  });
  return result;
}

export async function updateCategory(categoryId, input, { scope, actor, canEditCommission = false }) {
  const before = await Category.findById(categoryId).lean();
  if (!before) throw new NotFoundError('Category not found.');
  assertInScope(before, scope);
  // The editor sends every field on save, so only an actual change of rate needs the finance permission.
  if (input.commissionPct !== undefined && input.commissionPct !== (before.commissionPct ?? null) && !canEditCommission) {
    throw new ForbiddenError('Changing the commission rate needs the "Commission & fees: edit rules" permission.');
  }
  if (before.version !== input.version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this category while you were editing it.', {
      current: serializeCategory(before, await rootNameFor(before)),
    });
  }
  if (before.level !== 1 && input.color !== undefined) {
    throw new ValidationError('Only top-level categories can have a colour.', { color: ['Only top-level categories can have a colour.'] });
  }
  if (input.color != null && !HEX_COLOR.test(input.color)) {
    throw new ValidationError('Choose a valid colour.', { color: ['Choose a valid six-digit hex colour.'] });
  }
  if (before.level !== MAX_CATEGORY_LEVEL && input.attributeSetId !== undefined) {
    throw new ValidationError('Only level-three categories can have an attribute set.', {
      attributeSetId: ['Only level-three categories can have an attribute set.'],
    });
  }

  const { version, hideListings, reason, ...patch } = input;
  if (patch.name !== undefined) {
    patch.nameKey = categoryNameKey(patch.name);
    patch.slug = categorySlug(patch.name);
  }
  const returnWindowDays = patch.returnWindowDays ?? before.returnWindowDays;
  if (returnWindowDays === 0) patch.returnTypes = [];
  const changingSet = patch.attributeSetId !== undefined && id(patch.attributeSetId) !== id(before.attributeSetId);
  if (changingSet && patch.attributeSetId) await reserveAttributeSet(patch.attributeSetId, {
    rootId: before.rootId,
    rootName: await rootNameFor(before),
  });

  const descendantIds = await subtree(before._id);
  if (patch.status === 'HIDDEN' && before.status !== 'HIDDEN') {
    const stats = await Category.aggregate([
      { $match: { _id: { $in: descendantIds.map((value) => new mongoose.Types.ObjectId(value)) } } },
      { $group: { _id: null, liveListings: { $sum: '$liveListings' } } },
    ]);
    const liveListings = stats[0]?.liveListings ?? 0;
    if (liveListings > 0 && !hideListings) {
      throw new ConflictError(
        'CATEGORY_HAS_LISTINGS',
        `${liveListings} live listings sit in this category. Confirm that hiding it should take them down too.`,
        { liveListings },
      );
    }
  }

  let updated;
  try {
    updated = await Category.findOneAndUpdate(
      { _id: before._id, version },
      { $set: patch, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).lean();
  } catch (error) {
    if (changingSet && patch.attributeSetId) await releaseAttributeSet(patch.attributeSetId);
    throw duplicateNameError(error);
  }
  if (!updated) {
    if (changingSet && patch.attributeSetId) await releaseAttributeSet(patch.attributeSetId);
    const current = await Category.findById(categoryId).lean();
    if (!current) throw new NotFoundError('Category not found.');
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this category while you were editing it.', {
      current: serializeCategory(current, await rootNameFor(current)),
    });
  }
  if (changingSet && before.attributeSetId) await releaseAttributeSet(before.attributeSetId);
  if (patch.status === 'HIDDEN' && hideListings && descendantIds.length > 1) {
    await Category.updateMany(
      { _id: { $in: descendantIds.slice(1) } },
      { $set: { status: 'HIDDEN' }, $inc: { version: 1 } },
    );
  }

  const result = serializeCategory(updated, await rootNameFor(updated));
  await recordAudit({
    action: 'catalog.category.edit',
    subjectType: 'category',
    subjectId: updated._id,
    before: serializeCategory(before, await rootNameFor(before)),
    after: result,
    reason: reason ?? null,
    actor,
  });
  return result;
}

export async function deleteCategory(categoryId, { scope, actor }) {
  const category = await Category.findById(categoryId).lean();
  if (!category) throw new NotFoundError('Category not found.');
  assertInScope(category, scope);
  if (await Category.exists({ parentId: category._id })) {
    throw new ConflictError('CATEGORY_HAS_CHILDREN', 'Move or delete the child categories first.');
  }
  if (category.liveListings > 0 || category.productCount > 0) {
    throw new ConflictError('CATEGORY_HAS_PRODUCTS', 'Products still sit in this category.');
  }
  const removed = await Category.deleteOne({ _id: category._id, version: category.version });
  if (!removed.deletedCount) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this category.');
  if (category.attributeSetId) await releaseAttributeSet(category.attributeSetId);
  await recordAudit({
    action: 'catalog.category.delete',
    subjectType: 'category',
    subjectId: category._id,
    before: serializeCategory(category, await rootNameFor(category)),
    actor,
  });
  return { ok: true };
}

// ---- Customer app read model: ACTIVE categories only; a hidden parent hides its whole subtree. ----

const DEFAULT_TAB_COLOR = '#FFCB9D';


async function activeTree() {
  return categoryTree(await Category.find({ status: 'ACTIVE' }).lean(), (row) => row);
}

function findNode(nodes, categoryId) {
  for (const node of nodes) {
    const found = id(node._id) === categoryId ? node : findNode(node.children, categoryId);
    if (found) return found;
  }
  return null;
}

const customerTile = (node) => ({
  id: id(node._id),
  label: node.name,
  imageUrl: deviceUrl(node.imageUrl),
  icon: node.icon ?? null,
  target: { type: 'CATEGORY', id: id(node._id) },
});

/** Left sidebar of the app's "All Categories" screen: top-level categories. */
export async function listCustomerCategories() {
  return (await activeTree()).map((node) => ({
    id: id(node._id),
    name: node.name,
    imageUrl: deviceUrl(node.imageUrl),
    icon: node.icon ?? null,
  }));
}

/** Category strip in the home header; the admin-chosen colour tints the header gradient. */
export async function listHomeCategoryTabs() {
  return (await activeTree()).map((node) => ({
    id: id(node._id),
    label: node.name,
    icon: node.icon ?? 'grid',
    imageUrl: deviceUrl(node.imageUrl),
    gradient: [node.color ?? DEFAULT_TAB_COLOR, '#FFFFFF'],
  }));
}

/** Right pane of "All Categories": level-2 groups with their level-3 tiles. */
export async function getCustomerCategory(categoryId) {
  const node = findNode(await activeTree(), categoryId);
  if (!node) throw new NotFoundError('Category not found.');
  const groups = node.level === 1 ? node.children : [node];
  const section = (group, items = group.children) => ({
    id: id(group._id),
    title: group.name,
    viewAll: false,
    items: items.map(customerTile),
  });
  const bare = groups.filter((group) => group.children.length === 0 && group !== node);
  return {
    id: id(node._id),
    name: node.name,
    heroBanner: node.imageUrl ? { title: node.name, imageUrl: deviceUrl(node.imageUrl) } : null,
    sections: [
      ...groups.filter((group) => group.children.length > 0).map((group) => section(group)),
      // Level-2 categories with no level-3 children yet would otherwise be invisible.
      ...(bare.length ? [section({ _id: `${node._id}-more`, name: node.name }, bare)] : []),
    ],
  };
}

/**
 * Ids of the categories a customer can see (the category and every ancestor ACTIVE).
 * With categoryId, only that subtree; returns null when that category is not visible.
 */
export async function visibleCategoryIds(categoryId = null) {
  const tree = await activeTree();
  let nodes = tree;
  if (categoryId) {
    const node = findNode(tree, String(categoryId));
    if (!node) return null;
    nodes = [node];
  }
  const ids = [];
  const walk = (list) => list.forEach((node) => { ids.push(id(node._id)); walk(node.children); });
  walk(nodes);
  return ids;
}

/**
 * GST, HSN and the commission that apply to each category, for pricing an order: the leaf's own GST/HSN, and the
 * commission from the nearest category up the tree that sets one. Returns Map(categoryId -> { gstRate, hsnCode, commissionPct }).
 */
export async function getCategoryTerms(categoryIds) {
  const terms = new Map();
  for (const categoryId of new Set(categoryIds.map(String))) {
    const leaf = await Category.findById(categoryId, 'gstRate hsnCode parentId commissionPct').lean();
    if (!leaf) continue;
    const chain = [leaf];
    for (let parentId = leaf.parentId; parentId; ) {
      const parent = await Category.findById(parentId, 'parentId commissionPct name').lean();
      if (!parent) break;
      chain.push(parent);
      parentId = parent.parentId;
    }
    terms.set(categoryId, { gstRate: leaf.gstRate, hsnCode: leaf.hsnCode, commissionPct: effectiveCommission(chain).pct });
  }
  return terms;
}
