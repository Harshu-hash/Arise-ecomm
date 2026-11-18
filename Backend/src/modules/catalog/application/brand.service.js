import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { findRootCategoryByName } from '../../category/public/index.js';
import { brandNameKey } from '../domain/services/brandRules.js';
import { Brand } from '../infrastructure/persistence/brand.model.js';

const id = (value) => (value ? String(value) : null);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function serializeBrand(row) {
  return {
    id: id(row._id),
    name: row.name,
    imageUrl: row.imageUrl ?? null,
    rootCategoryId: id(row.rootCategoryId),
    rootCategory: row.rootCategory ?? null,
    status: row.status,
    ownerType: row.ownerType,
    gated: row.gated,
    productCount: row.productCount ?? 0,
    listings: row.listingCount ?? 0,
    authorisedSellerCount: row.authorisedSellerCount ?? 0,
    pendingRequests: 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function scopeRootIds(scope) {
  if (!Array.isArray(scope?.categories)) return null;
  return scope.categories.filter((value) => mongoose.isValidObjectId(value)).map(String);
}

function assertInScope(brand, scope) {
  const roots = scopeRootIds(scope);
  if (roots && !roots.includes(id(brand.rootCategoryId))) throw new NotFoundError('Brand not found.');
}

async function resolveRootCategory(rootCategory, scope) {
  const scopedRoots = scopeRootIds(scope);
  if (!rootCategory) {
    if (scopedRoots) {
      throw new ValidationError('Choose a root category.', { rootCategory: ['Choose a category assigned to you.'] });
    }
    return null;
  }
  const category = await findRootCategoryByName(rootCategory);
  if (!category || (scopedRoots && !scopedRoots.includes(category.id))) {
    throw new ValidationError('Root category not found.', { rootCategory: ['Choose an existing root category.'] });
  }
  return category;
}

function duplicateNameError(error) {
  if (error?.code !== 11000) return error;
  return new ValidationError('A brand with this name already exists.', {
    name: ['A brand with this name already exists.'],
  });
}

/** Brands a seller can pick from when listing a product: no scope, no pending/rejected noise. */
export async function listBrandsForSeller() {
  const rows = await Brand.find({ status: 'VERIFIED' }, 'name gated').sort({ name: 1, _id: 1 }).lean();
  return rows.map((row) => ({ id: id(row._id), name: row.name, gated: row.gated }));
}

/** A brand as a new product/listing needs it. */
export async function findBrandForListing(brandId) {
  const brand = await Brand.findById(brandId, 'name gated status').lean();
  return brand ? { id: id(brand._id), name: brand.name, gated: brand.gated, status: brand.status } : null;
}

/** Keeps `BRAND_IN_USE` delete checks honest once products/listings reference this brand. */
export async function incrementBrandUsage(brandId, { products = 0, listings = 0 } = {}) {
  if (!brandId || (!products && !listings)) return;
  await Brand.updateOne({ _id: brandId }, { $inc: { productCount: products, listingCount: listings } });
}

export async function listBrands(query, scope) {
  const filter = {};
  const scopedRoots = scopeRootIds(scope);
  if (scopedRoots) filter.rootCategoryId = { $in: scopedRoots };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }];
  }
  if (query.status) filter.status = query.status;
  if (query.gated !== undefined) filter.gated = query.gated;
  if (query.rootCategory) filter.rootCategory = query.rootCategory;
  if (query.ownerType) filter.ownerType = query.ownerType;

  const sortField = ['name', 'status', 'productCount', 'authorisedSellerCount', 'createdAt'].includes(query.sortField)
    ? query.sortField
    : 'name';
  const sort = { [sortField]: query.sortDirection, _id: 1 };
  const [rows, total, statuses] = await Promise.all([
    Brand.find(filter).sort(sort).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Brand.countDocuments(filter),
    Brand.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return {
    data: rows.map(serializeBrand),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { status: Object.fromEntries(statuses.map((item) => [item._id, item.count])) },
    },
  };
}

export async function createBrand(input, { scope, actor }) {
  const root = await resolveRootCategory(input.rootCategory, scope);
  const row = new Brand({
    name: input.name,
    nameKey: brandNameKey(input.name),
    imageUrl: input.imageUrl ?? null,
    rootCategoryId: root?.id ?? null,
    rootCategory: root?.name ?? null,
    ownerType: input.ownerType ?? 'BRAND_OWNER',
    gated: input.gated ?? false,
    status: 'VERIFIED',
  });
  try {
    await row.save();
  } catch (error) {
    throw duplicateNameError(error);
  }
  const result = serializeBrand(row.toObject());
  await recordAudit({
    action: 'catalog.brand.create',
    subjectType: 'brand',
    subjectId: row._id,
    after: result,
    actor,
  });
  return result;
}

export async function updateBrand(brandId, input, { scope, actor }) {
  const before = await Brand.findById(brandId).lean();
  if (!before) throw new NotFoundError('Brand not found.');
  assertInScope(before, scope);
  if (before.version !== input.version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this brand while you were editing it.', {
      current: serializeBrand(before),
    });
  }

  const patch = {};
  if (input.name !== undefined) {
    patch.name = input.name;
    patch.nameKey = brandNameKey(input.name);
  }
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
  if (input.gated !== undefined) patch.gated = input.gated;
  if (before.status === 'PENDING') patch.status = 'VERIFIED';
  if (input.rootCategory !== undefined) {
    const root = await resolveRootCategory(input.rootCategory, scope);
    patch.rootCategoryId = root?.id ?? null;
    patch.rootCategory = root?.name ?? null;
  }

  let updated;
  try {
    updated = await Brand.findOneAndUpdate(
      { _id: before._id, version: input.version },
      { $set: patch, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).lean();
  } catch (error) {
    throw duplicateNameError(error);
  }
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this brand while you were editing it.');

  const result = serializeBrand(updated);
  await recordAudit({
    action: 'catalog.brand.edit',
    subjectType: 'brand',
    subjectId: updated._id,
    before: serializeBrand(before),
    after: result,
    actor,
  });
  return result;
}

export async function deleteBrand(brandId, { scope, actor }) {
  const brand = await Brand.findById(brandId).lean();
  if (!brand) throw new NotFoundError('Brand not found.');
  assertInScope(brand, scope);
  if (brand.productCount > 0 || brand.listingCount > 0) {
    throw new ConflictError('BRAND_IN_USE', 'Products or listings still use this brand.');
  }

  const removed = await Brand.deleteOne({
    _id: brand._id,
    version: brand.version,
    productCount: 0,
    listingCount: 0,
  });
  if (!removed.deletedCount) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this brand.');

  await recordAudit({
    action: 'catalog.brand.delete',
    subjectType: 'brand',
    subjectId: brand._id,
    before: serializeBrand(brand),
    actor,
  });
  return { ok: true };
}
