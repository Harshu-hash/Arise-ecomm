import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { getUserAuthorization } from '../../identity/public/index.js';
import { MAX_PAGE_VERSIONS, PAGE_STATUS, STATIC_PAGES } from '../domain/constants/cms.js';
import { StaticPage } from '../infrastructure/persistence/staticPage.model.js';

const DUPLICATE_KEY = 11000;
const ORDER = new Map(STATIC_PAGES.map((page, index) => [page.slug, index]));

// The standard pages exist from the first visit; created once, never overwritten (admin edits are kept).
let seeding = null;
function ensureSeeded() {
  seeding ??= StaticPage.bulkWrite(
    STATIC_PAGES.map(({ slug, title }) => ({ updateOne: { filter: { slug }, update: { $setOnInsert: { title, body: '', status: PAGE_STATUS.DRAFT } }, upsert: true } })),
    { ordered: false },
  ).catch((error) => {
    seeding = null; // retry on the next request
    if (!error?.writeErrors?.every((e) => e.code === DUPLICATE_KEY)) throw error; // a parallel seed won the race
  });
  return seeding;
}

// Versions listed without their bodies: the list and history views never show them, and bodies can be large.
const serializeVersions = (versions) => versions.map(({ editedByName, editedAt, note }) => ({ editedByName, editedAt, note }));

function serializePage(row, { withBody = false } = {}) {
  return {
    id: String(row._id),
    slug: row.slug,
    title: row.title,
    status: row.status,
    requiresReacceptance: row.requiresReacceptance,
    publishedAt: row.publishedAt,
    versions: serializeVersions(row.versions),
    ...(withBody ? { body: row.body } : {}),
  };
}

export async function listPages() {
  await ensureSeeded();
  const rows = await StaticPage.find({}, '-body -versions.body').lean();
  return rows.sort((a, b) => (ORDER.get(a.slug) ?? 99) - (ORDER.get(b.slug) ?? 99)).map((row) => serializePage(row));
}

export async function getPage(id) {
  const page = await StaticPage.findById(id).lean();
  if (!page) throw new NotFoundError('That page no longer exists.');
  return serializePage(page, { withBody: true });
}

/** Saving a page publishes it at once; a material change asks customers to re-accept it. */
export async function publishPage(id, { body, materialChange, note }, actor) {
  const editedByName = (await getUserAuthorization(actor.userId))?.name ?? 'Admin';
  const now = new Date();
  const updated = await StaticPage.findByIdAndUpdate(
    id,
    {
      $set: { body, status: PAGE_STATUS.PUBLISHED, requiresReacceptance: materialChange, publishedAt: now },
      $push: { versions: { $each: [{ body, editedBy: actor.userId, editedByName, editedAt: now, note: note || null }], $slice: -MAX_PAGE_VERSIONS } },
    },
    { new: true },
  ).lean();
  if (!updated) throw new NotFoundError('That page no longer exists.');
  await recordAudit({ action: 'cms.page.publish', subjectType: 'staticPage', subjectId: id, after: { slug: updated.slug, materialChange }, reason: note || null, actor });
  return serializePage(updated, { withBody: true });
}
