import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { findCategoryForCatalog } from '../../category/public/index.js';
import { sizeChartNameKey, validateSizeChartGrid } from '../domain/services/sizeChartRules.js';
import { SizeChart } from '../infrastructure/persistence/sizeChart.model.js';

const id = (value) => (value ? String(value) : null);

export function serializeSizeChart(row) {
  return {
    id: id(row._id),
    name: row.name,
    unit: row.unit,
    categoryId: id(row.categoryId?._id ?? row.categoryId),
    categoryName: row.categoryId?.name ?? null,
    columns: row.columns,
    rows: row.rows,
    productCount: row.productCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function scopeRootIds(scope) {
  if (!Array.isArray(scope?.categories)) return null;
  return scope.categories.filter((value) => mongoose.isValidObjectId(value)).map(String);
}

function assertInScope(chart, scope) {
  const roots = scopeRootIds(scope);
  if (roots && !roots.includes(id(chart.rootCategoryId))) throw new NotFoundError('Size chart not found.');
}

async function resolveCategory(categoryId, scope) {
  const roots = scopeRootIds(scope);
  if (!categoryId) {
    if (roots) throw new ValidationError('Choose a category.', { categoryId: ['Choose a category assigned to you.'] });
    return null;
  }
  const category = await findCategoryForCatalog(categoryId);
  if (!category || (roots && !roots.includes(category.rootId))) {
    throw new ValidationError('Category not found.', { categoryId: ['Choose a category assigned to you.'] });
  }
  return category;
}

function duplicateNameError(error) {
  if (error?.code !== 11000) return error;
  return new ValidationError('A size chart with this name already exists.', {
    name: ['A size chart with this name already exists.'],
  });
}

export async function listSizeCharts(scope) {
  const roots = scopeRootIds(scope);
  const filter = roots ? { rootCategoryId: { $in: roots } } : {};
  const rows = await SizeChart.find(filter).sort({ name: 1, _id: 1 }).populate('categoryId', 'name').lean();
  return rows.map(serializeSizeChart);
}

export async function listSizeChartsForCategory(categoryId) {
  const rows = await SizeChart.find({ categoryId }).sort({ name: 1, _id: 1 }).lean();
  return rows.map((row) => ({ id: id(row._id), name: row.name }));
}

/** Confirms a size chart a seller picked actually belongs to this product's category. */
export async function findSizeChartForListing(sizeChartId, categoryId) {
  const chart = await SizeChart.findOne({ _id: sizeChartId, categoryId }, '_id').lean();
  return chart ? id(chart._id) : null;
}

/** Keeps `SIZECHART_IN_USE` delete/move checks honest once products reference this chart. */
export async function incrementSizeChartUsage(sizeChartId, delta) {
  if (!sizeChartId || !delta) return;
  await SizeChart.updateOne({ _id: sizeChartId }, { $inc: { productCount: delta } });
}

export async function createSizeChart(input, { scope, actor }) {
  validateSizeChartGrid(input.columns, input.rows);
  const category = await resolveCategory(input.categoryId, scope);
  const row = new SizeChart({
    name: input.name,
    nameKey: sizeChartNameKey(input.name),
    unit: input.unit,
    categoryId: category?.id ?? null,
    rootCategoryId: category?.rootId ?? null,
    columns: input.columns,
    rows: input.rows,
  });
  try {
    await row.save();
  } catch (error) {
    throw duplicateNameError(error);
  }
  const result = serializeSizeChart({ ...row.toObject(), categoryId: category ? { _id: category.id, name: category.name } : null });
  await recordAudit({ action: 'catalog.sizechart.create', subjectType: 'sizeChart', subjectId: row._id, after: result, actor });
  return result;
}

export async function updateSizeChart(chartId, input, { scope, actor }) {
  const before = await SizeChart.findById(chartId).populate('categoryId', 'name').lean();
  if (!before) throw new NotFoundError('Size chart not found.');
  assertInScope(before, scope);
  if (before.version !== input.version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this size chart while you were editing it.', {
      current: serializeSizeChart(before),
    });
  }

  const columns = input.columns ?? before.columns;
  const rows = input.rows ?? before.rows;
  validateSizeChartGrid(columns, rows);
  const patch = {};
  if (input.name !== undefined) {
    patch.name = input.name;
    patch.nameKey = sizeChartNameKey(input.name);
  }
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.columns !== undefined) patch.columns = input.columns;
  if (input.rows !== undefined) patch.rows = input.rows;
  let category = before.categoryId ? { id: id(before.categoryId._id), name: before.categoryId.name, rootId: id(before.rootCategoryId) } : null;
  if (input.categoryId !== undefined) {
    category = await resolveCategory(input.categoryId, scope);
    if (before.productCount > 0 && id(before.categoryId?._id) !== category?.id) {
      throw new ConflictError('SIZECHART_IN_USE', 'Move products off this size chart before changing its category.');
    }
    patch.categoryId = category?.id ?? null;
    patch.rootCategoryId = category?.rootId ?? null;
  }

  let updated;
  try {
    updated = await SizeChart.findOneAndUpdate(
      { _id: before._id, version: input.version },
      { $set: patch, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).populate('categoryId', 'name').lean();
  } catch (error) {
    throw duplicateNameError(error);
  }
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this size chart.');
  const result = serializeSizeChart(updated);
  await recordAudit({
    action: 'catalog.sizechart.edit', subjectType: 'sizeChart', subjectId: updated._id,
    before: serializeSizeChart(before), after: result, actor,
  });
  return result;
}

export async function deleteSizeChart(chartId, { scope, actor }) {
  const chart = await SizeChart.findById(chartId).populate('categoryId', 'name').lean();
  if (!chart) throw new NotFoundError('Size chart not found.');
  assertInScope(chart, scope);
  if (chart.productCount > 0) throw new ConflictError('SIZECHART_IN_USE', 'Products still use this size chart.');
  const removed = await SizeChart.deleteOne({ _id: chart._id, version: chart.version, productCount: 0 });
  if (!removed.deletedCount) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this size chart.');
  await recordAudit({
    action: 'catalog.sizechart.delete', subjectType: 'sizeChart', subjectId: chart._id,
    before: serializeSizeChart(chart), actor,
  });
  return { ok: true };
}
