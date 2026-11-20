import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { assertMakerChecker } from '../../../shared/policies/ownership.js';
import { listHomeCategoryTabs } from '../../category/public/index.js';
import { getUserAuthorization } from '../../identity/public/index.js';
import { HOME_BRAND_TABS, HOME_SLOT, HOME_VERSION_STATUS, MAX_HOME_VERSIONS } from '../domain/constants/cms.js';
import { cleanConfig, enabledSections, sectionErrors } from '../domain/services/homeLayoutRules.js';
import { BrandTab, CategoryTab, HomeLayoutVersion } from '../infrastructure/persistence/homeLayout.models.js';

const DUPLICATE_KEY = 11000;
const idOf = (value) => String(value);
const actorName = async (actor) => (await getUserAuthorization(actor.userId))?.name ?? 'Admin';

/* ------------------------------------------------------------------ versions */

export function serializeVersion(row) {
  return {
    id: idOf(row._id),
    status: row.slot ?? HOME_VERSION_STATUS.ARCHIVED,
    sections: row.sections.map(({ type, config, visibility }) => ({ type, config: config ?? {}, visibility: { enabled: visibility?.enabled !== false } })),
    note: row.note,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
    publishedAt: row.publishedAt,
    publishedByName: row.publishedByName,
    rollbackRequest: row.rollbackRequest
      ? { reason: row.rollbackRequest.reason, requestedBy: row.rollbackRequest.requestedBy, requestedByName: row.rollbackRequest.requestedByName, requestedAt: row.rollbackRequest.requestedAt }
      : null,
  };
}

// Editing always happens on a draft; the first one starts from what is published so there is always something to edit.
async function ensureDraft(actor) {
  const existing = await HomeLayoutVersion.findOne({ slot: HOME_SLOT.DRAFT }).lean();
  if (existing) return existing;
  const published = await HomeLayoutVersion.findOne({ slot: HOME_SLOT.PUBLISHED }).lean();
  try {
    return (await HomeLayoutVersion.create({ slot: HOME_SLOT.DRAFT, sections: published?.sections ?? [], createdBy: actor.userId, createdByName: await actorName(actor) })).toObject();
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY) throw error;
    return HomeLayoutVersion.findOne({ slot: HOME_SLOT.DRAFT }).lean(); // another admin created it a moment ago
  }
}

export async function getDraft(actor) {
  return serializeVersion(await ensureDraft(actor));
}

export async function updateDraft(input, actor) {
  const sections = input.map((section) => ({ ...section, config: cleanConfig(section.type, section.config) }));
  const errors = sectionErrors(sections);
  if (errors) throw new ValidationError('Invalid layout.', errors);
  await ensureDraft(actor);
  // Draft autosaves are not audited (one per click); publishing and rolling back are.
  const draft = await HomeLayoutVersion.findOneAndUpdate({ slot: HOME_SLOT.DRAFT }, { $set: { sections } }, { new: true }).lean();
  if (!draft) throw new ConflictError('DRAFT_PUBLISHED', 'This draft was just published. Reload to continue editing.');
  return serializeVersion(draft);
}

export async function listVersions() {
  return (await HomeLayoutVersion.find({}).sort({ createdAt: -1, _id: -1 }).limit(MAX_HOME_VERSIONS).lean()).map(serializeVersion);
}

async function appJson(version) {
  const [categoryTabs, topBrandTabs] = await Promise.all([
    CategoryTab.find({ active: true }).sort({ order: 1 }).lean(),
    BrandTab.find({ active: true }).sort({ order: 1 }).lean(),
  ]);
  return {
    publishedAt: version.publishedAt,
    version: idOf(version._id),
    sections: enabledSections(version.sections).map(({ type, config, visibility }) => ({ type, config: config ?? {}, visibility: { enabled: visibility?.enabled !== false } })),
    categoryTabs: categoryTabs.map((tab) => ({ label: tab.label, icon: tab.icon, gradient: tab.gradient, layoutVariant: tab.layoutVariant })),
    topBrandTabs: topBrandTabs.map((tab) => ({ label: tab.label, logo: tab.logo, target: tab.target })),
  };
}

export async function getPublished() {
  const version = await HomeLayoutVersion.findOne({ slot: HOME_SLOT.PUBLISHED }).lean();
  if (!version) throw new NotFoundError('Nothing has been published yet.');
  return appJson(version);
}

/** The sections of the published layout (customer home screen), or null when nothing is published. */
export async function getPublishedSections() {
  const version = await HomeLayoutVersion.findOne({ slot: HOME_SLOT.PUBLISHED }, 'sections').lean();
  return version?.sections ?? null;
}

// The previous layout steps aside first (never the one being promoted, so a concurrent publish cannot archive the winner).
const archivePublished = (exceptId = null) =>
  HomeLayoutVersion.updateOne({ slot: HOME_SLOT.PUBLISHED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { $unset: { slot: 1 } });

export async function publishHome({ note }, actor) {
  const draft = await ensureDraft(actor);
  if (!enabledSections(draft.sections).length) {
    throw new ValidationError('Nothing to publish.', { sections: ['Turn on at least one section before publishing.'] });
  }
  await archivePublished(draft._id);
  const published = await HomeLayoutVersion.findOneAndUpdate(
    { _id: draft._id, slot: HOME_SLOT.DRAFT },
    { $set: { slot: HOME_SLOT.PUBLISHED, note: note || null, publishedBy: actor.userId, publishedByName: await actorName(actor), publishedAt: new Date() } },
    { new: true },
  ).lean();
  if (!published) throw new ConflictError('DRAFT_PUBLISHED', 'This draft was just published by someone else.');
  // The builder always has somewhere to keep working: a fresh draft that starts from what just went live.
  await ensureDraft(actor);
  await recordAudit({ action: 'cms.home.publish', subjectType: 'homeLayout', subjectId: published._id, after: { sections: published.sections.length }, reason: note || null, actor });
  return appJson(published);
}

/* ---------------------------------------------------------- rollback (maker-checker) */

export async function requestRollback({ versionId, reason }, actor) {
  const target = await HomeLayoutVersion.findById(versionId).lean();
  if (!target) throw new NotFoundError('That version no longer exists.');
  if (target.slot) throw new ConflictError('ILLEGAL_TRANSITION', 'Only an archived version can be rolled back to.');
  if (await HomeLayoutVersion.exists({ rollbackRequest: { $ne: null } })) {
    throw new ConflictError('ROLLBACK_PENDING', 'Another rollback is already waiting for approval.');
  }
  const request = { reason, requestedBy: actor.userId, requestedByName: await actorName(actor), requestedAt: new Date() };
  await HomeLayoutVersion.updateOne({ _id: versionId }, { $set: { rollbackRequest: request } });
  await recordAudit({ action: 'cms.home.rollback.request', subjectType: 'homeLayout', subjectId: versionId, reason, actor });
  return { versionId, status: 'PENDING_APPROVAL' };
}

/** A different admin approves (the rollback goes live) or rejects it; the requester may also withdraw their own. */
export async function decideRollback(versionId, approve, actor) {
  const target = await HomeLayoutVersion.findById(versionId).lean();
  if (!target?.rollbackRequest) throw new NotFoundError('There is no rollback waiting for approval on that version.');
  if (approve) assertMakerChecker(target.rollbackRequest.requestedBy, actor.userId);
  // Claiming the request first makes a double approval impossible.
  const claimed = await HomeLayoutVersion.findOneAndUpdate({ _id: versionId, rollbackRequest: { $ne: null } }, { $set: { rollbackRequest: null } }).lean();
  if (!claimed) throw new ConflictError('ROLLBACK_DECIDED', 'This rollback was just decided by someone else.');

  if (!approve) {
    await recordAudit({ action: 'cms.home.rollback.reject', subjectType: 'homeLayout', subjectId: versionId, actor });
    return { versionId, status: 'REJECTED' };
  }
  await archivePublished();
  const restored = await HomeLayoutVersion.create({
    slot: HOME_SLOT.PUBLISHED,
    sections: target.sections,
    note: `Rolled back to the version from ${(target.publishedAt ?? target.createdAt).toISOString().slice(0, 10)}`,
    createdBy: target.createdBy,
    createdByName: target.createdByName,
    publishedBy: actor.userId,
    publishedByName: await actorName(actor),
    publishedAt: new Date(),
  });
  await recordAudit({ action: 'cms.home.rollback.approve', subjectType: 'homeLayout', subjectId: restored._id, after: { restoredFrom: idOf(versionId) }, reason: target.rollbackRequest.reason, actor });
  return { versionId, status: 'APPROVED', publishedId: idOf(restored._id) };
}

/* --------------------------------------------------------------------- tabs */

const serializeCategoryTab = (row) => ({
  id: idOf(row._id),
  categoryId: idOf(row.categoryId),
  label: row.label,
  icon: row.icon,
  gradient: row.gradient,
  layoutVariant: row.layoutVariant,
  active: row.active,
  order: row.order,
});

const serializeBrandTab = (row) => ({ id: idOf(row._id), key: row.key, label: row.label, logo: row.logo, target: row.target, active: row.active, order: row.order });

// New root categories get a tab (visible, last); existing tabs keep the admin's changes.
async function syncCategoryTabs() {
  const live = await listHomeCategoryTabs();
  const known = new Set((await CategoryTab.find({}, 'categoryId').lean()).map((tab) => idOf(tab.categoryId)));
  const fresh = live.filter((tab) => !known.has(tab.id));
  if (fresh.length) {
    const next = await CategoryTab.countDocuments();
    await CategoryTab.insertMany(
      fresh.map((tab, index) => ({ categoryId: tab.id, label: tab.label, icon: tab.icon, gradient: tab.gradient, order: next + index })),
      { ordered: false },
    ).catch((error) => {
      if (error?.code !== DUPLICATE_KEY && !error?.writeErrors?.every((e) => e.code === DUPLICATE_KEY)) throw error; // a parallel sync won the race
    });
  }
  return new Set(live.map((tab) => tab.id));
}

export async function listCategoryTabs() {
  const live = await syncCategoryTabs();
  const rows = await CategoryTab.find({}).sort({ order: 1 }).lean();
  return rows.filter((row) => live.has(idOf(row.categoryId))).map(serializeCategoryTab);
}

export async function updateCategoryTab(id, patch, actor) {
  const updated = await CategoryTab.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  if (!updated) throw new NotFoundError('That tab no longer exists.');
  await recordAudit({ action: 'cms.home.category_tab.edit', subjectType: 'categoryTab', subjectId: id, after: patch, actor });
  return serializeCategoryTab(updated);
}

export async function reorderCategoryTabs(orderedIds, actor) {
  const current = (await listCategoryTabs()).map((tab) => tab.id);
  if (orderedIds.length !== current.length || !current.every((id) => orderedIds.includes(id))) {
    throw new ValidationError('Invalid order.', { orderedIds: ['Send every tab exactly once.'] });
  }
  await CategoryTab.bulkWrite(orderedIds.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  await recordAudit({ action: 'cms.home.category_tab.reorder', subjectType: 'categoryTab', subjectId: 'all', after: { orderedIds }, actor });
  return listCategoryTabs();
}

export async function listBrandTabs() {
  await BrandTab.bulkWrite(
    HOME_BRAND_TABS.map((tab, order) => ({ updateOne: { filter: { key: tab.id }, update: { $setOnInsert: { label: tab.label, target: tab.id, order } }, upsert: true } })),
    { ordered: false },
  ).catch((error) => {
    if (!error?.writeErrors?.every((e) => e.code === DUPLICATE_KEY)) throw error;
  });
  return (await BrandTab.find({}).sort({ order: 1 }).lean()).map(serializeBrandTab);
}

export async function updateBrandTab(id, patch, actor) {
  const updated = await BrandTab.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  if (!updated) throw new NotFoundError('That tab no longer exists.');
  await recordAudit({ action: 'cms.home.brand_tab.edit', subjectType: 'brandTab', subjectId: id, after: patch, actor });
  return serializeBrandTab(updated);
}

/* --------------------------------------------- what customers see (public facade) */

/** The home header's category tabs with the console's label/colour/order/visibility applied; new categories show last. */
export async function applyCategoryTabOverrides(tabs) {
  const rows = await CategoryTab.find({}).lean();
  if (!rows.length) return tabs;
  const byCategory = new Map(rows.map((row) => [idOf(row.categoryId), row]));
  const rank = (tab) => byCategory.get(tab.id)?.order ?? Number.MAX_SAFE_INTEGER;
  return tabs
    .filter((tab) => byCategory.get(tab.id)?.active !== false)
    .map((tab) => {
      const row = byCategory.get(tab.id);
      return row ? { ...tab, label: row.label, icon: row.icon, gradient: row.gradient ?? tab.gradient } : tab;
    })
    .sort((a, b) => rank(a) - rank(b));
}

/** The brand switch in the home header with the console's label and visibility applied. */
export async function applyBrandTabOverrides(tabs) {
  const byKey = new Map((await BrandTab.find({}).lean()).map((row) => [row.key, row]));
  return tabs.filter((tab) => byKey.get(tab.id)?.active !== false).map((tab) => ({ ...tab, label: byKey.get(tab.id)?.label ?? tab.label }));
}
