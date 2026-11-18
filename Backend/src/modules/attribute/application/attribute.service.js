import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import {
  OPTION_TYPES,
  attributeCode,
  attributeNameKey,
  normalizeAttributeValues,
  validateAttributeShape,
} from '../domain/services/attributeRules.js';
import { Attribute } from '../infrastructure/persistence/attribute.model.js';
import { AttributeSet } from '../infrastructure/persistence/attributeSet.model.js';

const id = (value) => (value ? String(value) : null);

export function serializeAttribute(row, { activeOnly = false } = {}) {
  const values = (row.values ?? [])
    .filter((value) => !activeOnly || value.active)
    .map((value) => ({ value: value.value, active: value.active, synonyms: value.synonyms ?? [] }));
  return {
    id: id(row._id),
    name: row.name,
    code: row.code,
    type: row.type,
    unit: row.unit ?? null,
    filterable: row.filterable,
    variantDefining: row.variantDefining,
    values,
    usedInCategories: row.usedInCategories ?? 0,
    version: row.version,
  };
}

export function serializeAttributeSet(row) {
  return {
    id: id(row._id),
    name: row.name,
    rootName: row.rootName ?? null,
    attributeIds: (row.attributeIds ?? []).map(id),
    usedInCategories: row.usedInCategories ?? 0,
    version: row.version,
  };
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function duplicateError(error, field, message) {
  if (error?.code !== 11000) return error;
  return new ValidationError(message, { [field]: [message] });
}

export async function listAttributes(query) {
  const filter = {};
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { code: pattern }];
  }
  if (query.type?.length) filter.type = { $in: query.type };
  if (query.filterable !== undefined) filter.filterable = query.filterable;
  if (query.variantDefining !== undefined) filter.variantDefining = query.variantDefining;

  const sortField = ['name', 'code', 'type', 'usedInCategories'].includes(query.sortField)
    ? query.sortField
    : 'name';
  const sort = { [sortField]: query.sortDirection, _id: 1 };
  const [rows, total, facets] = await Promise.all([
    Attribute.find(filter).sort(sort).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Attribute.countDocuments(filter),
    Attribute.aggregate([{ $match: filter }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);
  return {
    data: rows.map((row) => serializeAttribute(row)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { type: Object.fromEntries(facets.map((item) => [item._id, item.count])) },
    },
  };
}

export async function createAttribute(input, actor) {
  const values = normalizeAttributeValues(input.values ?? []);
  const shapeErrors = validateAttributeShape({ ...input, values });
  if (Object.keys(shapeErrors).length) throw new ValidationError('Invalid attribute.', shapeErrors);
  const row = new Attribute({
    ...input,
    code: attributeCode(input.code),
    unit: input.unit || null,
    values: OPTION_TYPES.has(input.type) ? values : [],
  });
  try {
    await row.save();
  } catch (error) {
    throw duplicateError(error, 'code', 'An attribute with this code already exists.');
  }
  const result = serializeAttribute(row.toObject());
  await recordAudit({ action: 'catalog.attribute.create', subjectType: 'attribute', subjectId: row._id, after: result, actor });
  return result;
}

export async function updateAttribute(attributeId, input, actor) {
  const before = await Attribute.findById(attributeId).lean();
  if (!before) throw new NotFoundError('Attribute not found.');
  if (before.version !== input.version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute.', { current: serializeAttribute(before) });
  }
  const type = input.type ?? before.type;
  if (type !== before.type && before.usedInCategories > 0) {
    throw new ConflictError('ATTRIBUTE_IN_USE', `This attribute is used by ${before.usedInCategories} categories, so its type cannot change.`);
  }
  if (input.variantDefining !== undefined && input.variantDefining !== before.variantDefining && before.usedInCategories > 0) {
    throw new ConflictError(
      'ATTRIBUTE_IN_USE',
      `This attribute is used by ${before.usedInCategories} categories, so its variant behavior cannot change.`,
    );
  }
  const suppliedValues = input.values === undefined ? before.values : input.values;
  const values = OPTION_TYPES.has(type)
    ? normalizeAttributeValues(suppliedValues, before.values, before.usedInCategories > 0)
    : [];
  const candidate = {
    type,
    values,
    variantDefining: input.variantDefining ?? before.variantDefining,
  };
  const shapeErrors = validateAttributeShape(candidate);
  if (Object.keys(shapeErrors).length) throw new ValidationError('Invalid attribute.', shapeErrors);

  const patch = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.type !== undefined ? { type } : {}),
    ...(input.unit !== undefined ? { unit: input.unit || null } : {}),
    ...(input.filterable !== undefined ? { filterable: input.filterable } : {}),
    ...(input.variantDefining !== undefined ? { variantDefining: input.variantDefining } : {}),
    ...(input.values !== undefined || input.type !== undefined ? { values } : {}),
  };
  const updated = await Attribute.findOneAndUpdate(
    { _id: before._id, version: input.version },
    { $set: patch, $inc: { version: 1 } },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute.');
  const result = serializeAttribute(updated);
  await recordAudit({
    action: 'catalog.attribute.edit', subjectType: 'attribute', subjectId: updated._id,
    before: serializeAttribute(before), after: result, actor,
  });
  return result;
}

export async function deleteAttribute(attributeId, actor) {
  const attribute = await Attribute.findById(attributeId).lean();
  if (!attribute) throw new NotFoundError('Attribute not found.');
  if (attribute.usedInCategories > 0) {
    throw new ConflictError('ATTRIBUTE_IN_USE', `This attribute is used by ${attribute.usedInCategories} categories and cannot be deleted.`);
  }
  if (await AttributeSet.exists({ attributeIds: attribute._id })) {
    throw new ConflictError('ATTRIBUTE_IN_SET', 'Remove this attribute from its attribute sets first.');
  }
  const removed = await Attribute.deleteOne({ _id: attribute._id, version: attribute.version });
  if (!removed.deletedCount) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute.');
  await recordAudit({
    action: 'catalog.attribute.delete', subjectType: 'attribute', subjectId: attribute._id,
    before: serializeAttribute(attribute), actor,
  });
  return { ok: true };
}

async function validatedAttributeIds(attributeIds) {
  const ids = [...new Set(attributeIds.map(String))];
  const count = await Attribute.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) throw new ValidationError('One or more attributes do not exist.', { attributeIds: ['One or more attributes do not exist.'] });
  return ids;
}

export async function listAttributeSets() {
  const rows = await AttributeSet.find().sort({ name: 1, _id: 1 }).lean();
  return rows.map(serializeAttributeSet);
}

export async function createAttributeSet(input, actor) {
  const attributeIds = await validatedAttributeIds(input.attributeIds);
  const row = new AttributeSet({
    name: input.name,
    nameKey: attributeNameKey(input.name),
    rootName: input.rootName || null,
    attributeIds,
  });
  try {
    await row.save();
  } catch (error) {
    throw duplicateError(error, 'name', 'An attribute set with this name already exists.');
  }
  const result = serializeAttributeSet(row.toObject());
  await recordAudit({ action: 'catalog.attribute_set.create', subjectType: 'attributeSet', subjectId: row._id, after: result, actor });
  return result;
}

export async function updateAttributeSet(setId, input, actor) {
  const before = await AttributeSet.findById(setId).lean();
  if (!before) throw new NotFoundError('Attribute set not found.');
  if (before.version !== input.version) {
    throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute set.', { current: serializeAttributeSet(before) });
  }
  const attributeIds = input.attributeIds === undefined
    ? before.attributeIds.map(String)
    : await validatedAttributeIds(input.attributeIds);
  const previousIds = new Set(before.attributeIds.map(String));
  const nextIds = new Set(attributeIds);
  const added = attributeIds.filter((value) => !previousIds.has(value));
  const removed = before.attributeIds.map(String).filter((value) => !nextIds.has(value));
  const changingRoot = input.rootName !== undefined && (input.rootName || null) !== (before.rootName || null);
  if (before.usedInCategories > 0 && (removed.length || changingRoot)) {
    throw new ConflictError(
      'ATTRIBUTE_SET_IN_USE',
      'Detach this attribute set from its categories before removing attributes or changing its applicability.',
    );
  }
  const patch = {
    ...(input.name !== undefined ? { name: input.name, nameKey: attributeNameKey(input.name) } : {}),
    ...(input.rootName !== undefined ? { rootName: input.rootName || null, ...(changingRoot ? { rootId: null } : {}) } : {}),
    ...(input.attributeIds !== undefined ? { attributeIds } : {}),
  };
  let updated;
  try {
    updated = await AttributeSet.findOneAndUpdate(
      { _id: before._id, version: input.version },
      { $set: patch, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).lean();
  } catch (error) {
    throw duplicateError(error, 'name', 'An attribute set with this name already exists.');
  }
  if (!updated) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute set.');
  if (before.usedInCategories > 0) {
    if (added.length) await Attribute.updateMany({ _id: { $in: added } }, { $inc: { usedInCategories: before.usedInCategories } });
    if (removed.length) await Attribute.updateMany({ _id: { $in: removed } }, { $inc: { usedInCategories: -before.usedInCategories } });
  }
  const result = serializeAttributeSet(updated);
  await recordAudit({
    action: 'catalog.attribute_set.edit', subjectType: 'attributeSet', subjectId: updated._id,
    before: serializeAttributeSet(before), after: result, actor,
  });
  return result;
}

export async function deleteAttributeSet(setId, actor) {
  const set = await AttributeSet.findById(setId).lean();
  if (!set) throw new NotFoundError('Attribute set not found.');
  if (set.usedInCategories > 0) {
    throw new ConflictError('ATTRIBUTE_SET_IN_USE', `${set.usedInCategories} categories use this set and must be reassigned first.`);
  }
  const removed = await AttributeSet.deleteOne({ _id: set._id, version: set.version, usedInCategories: 0 });
  if (!removed.deletedCount) throw new ConflictError('VERSION_CONFLICT', 'Someone else changed this attribute set.');
  await recordAudit({
    action: 'catalog.attribute_set.delete', subjectType: 'attributeSet', subjectId: set._id,
    before: serializeAttributeSet(set), actor,
  });
  return { ok: true };
}

export async function attributeSetDetails(setId, { activeOnly = false } = {}) {
  if (!setId) return { attributeSet: null, attributes: [] };
  const set = await AttributeSet.findById(setId).lean();
  if (!set) return { attributeSet: null, attributes: [] };
  const rows = await Attribute.find({ _id: { $in: set.attributeIds } }).lean();
  const byId = new Map(rows.map((row) => [id(row._id), row]));
  return {
    attributeSet: serializeAttributeSet(set),
    attributes: set.attributeIds.map((value) => byId.get(id(value))).filter(Boolean).map((row) => serializeAttribute(row, { activeOnly })),
  };
}

export async function reserveAttributeSet(setId, { rootId, rootName }) {
  if (!setId) return;
  const set = await AttributeSet.findById(setId).select('+rootId').lean();
  if (!set) throw new ValidationError('Attribute set not found.', { attributeSetId: ['Attribute set not found.'] });
  const wrongBoundRoot = set.rootId && id(set.rootId) !== id(rootId);
  const wrongUnboundRoot = !set.rootId && set.rootName && attributeNameKey(set.rootName) !== attributeNameKey(rootName);
  if (wrongBoundRoot || wrongUnboundRoot) {
    throw new ValidationError('This attribute set does not apply to the category root.', {
      attributeSetId: [`Choose a set for ${rootName} or one that applies to any category.`],
    });
  }
  const reserved = await AttributeSet.findOneAndUpdate(
    { _id: set._id, version: set.version },
    {
      ...(set.rootName && !set.rootId ? { $set: { rootId } } : {}),
      $inc: { usedInCategories: 1, version: 1 },
    },
    { new: true },
  ).lean();
  if (!reserved) throw new ConflictError('VERSION_CONFLICT', 'The attribute set changed while it was being assigned.');
  if (set.attributeIds.length) await Attribute.updateMany({ _id: { $in: set.attributeIds } }, { $inc: { usedInCategories: 1 } });
}

export async function releaseAttributeSet(setId) {
  if (!setId || !mongoose.isValidObjectId(setId)) return;
  const set = await AttributeSet.findOneAndUpdate(
    { _id: setId, usedInCategories: { $gt: 0 } },
    { $inc: { usedInCategories: -1, version: 1 } },
    { new: false },
  ).lean();
  if (set?.attributeIds.length) await Attribute.updateMany(
    { _id: { $in: set.attributeIds }, usedInCategories: { $gt: 0 } },
    { $inc: { usedInCategories: -1 } },
  );
}
