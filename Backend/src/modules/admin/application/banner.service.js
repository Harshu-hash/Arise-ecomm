import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { bannerStatus, isValidWindow, statusFilter } from '../domain/services/bannerRules.js';
import { Banner } from '../infrastructure/persistence/banner.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function serializeBanner(row, now = new Date()) {
  return {
    id: String(row._id),
    name: row.name,
    kind: row.kind,
    images: row.images,
    videoUrl: row.videoUrl ?? '',
    altText: row.altText,
    placements: row.placements,
    categoryIds: (row.categoryIds ?? []).map(String),
    priority: row.priority,
    status: bannerStatus(row, now),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.impressions ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
    createdAt: row.createdAt,
  };
}

// Banner dates are whole days picked in the admin's own timezone, so a day of grace keeps "today" valid anywhere.
const DAY_MS = 24 * 60 * 60 * 1000;
const startError = () => new ValidationError('Invalid schedule.', { startsAt: ['The start date is in the past.'] });

const windowError = () => new ValidationError('Invalid schedule.', { endsAt: ['The end must be after the start.'] });

export async function listBanners({ page, pageSize, q, kind, status, sortField, sortDirection }) {
  const now = new Date();
  const search = q ? { name: new RegExp(escapeRegex(q), 'i') } : {};
  const filter = {
    ...search,
    ...(kind.length ? { kind: { $in: kind } } : {}),
    ...(status.length ? statusFilter(status, now) : {}),
  };
  const [rows, total, [facets]] = await Promise.all([
    Banner.find(filter).sort({ [sortField]: sortDirection, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Banner.countDocuments(filter),
    // Tab/filter badges ignore the status and kind filters so each keeps its own count.
    Banner.aggregate([
      { $match: search },
      {
        $facet: {
          status: [
            {
              $group: {
                _id: { $switch: { branches: [{ case: { $gt: ['$startsAt', now] }, then: 'SCHEDULED' }, { case: { $lt: ['$endsAt', now] }, then: 'EXPIRED' }], default: 'LIVE' } },
                count: { $sum: 1 },
              },
            },
          ],
          kind: [{ $group: { _id: '$kind', count: { $sum: 1 } } }],
        },
      },
    ]),
  ]);
  const toMap = (items) => Object.fromEntries(items.map((item) => [item._id, item.count]));
  return {
    data: rows.map((row) => serializeBanner(row, now)),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets: { status: toMap(facets.status), kind: toMap(facets.kind) },
    },
  };
}

// A category-page banner with no category would never show anywhere.
function assertCategoriesChosen({ placements, categoryIds }) {
  if (placements.includes('CATEGORY_HERO') && !categoryIds.length) {
    throw new ValidationError('Choose a category.', { categoryIds: ['Choose at least one category for a category page banner.'] });
  }
}

/** A banner shows an image or a video, exactly one; only a hero can be a video. */
function assertMedia({ kind, images, videoUrl }) {
  const hasImage = Boolean(images?.mobile_16_9);
  const hasVideo = Boolean(videoUrl);
  const fail = (message) => new ValidationError('Invalid banner.', { imageUrl: [message] });
  if (hasImage === hasVideo) throw fail('Add either an image or a video, not both or neither.');
  if (hasVideo && kind !== 'HERO') throw fail('Only a hero banner can be a video.');
}

export async function createBanner(input, actor) {
  assertMedia(input);
  assertCategoriesChosen(input);
  if (!isValidWindow(input.startsAt, input.endsAt)) throw windowError();
  if (input.startsAt < new Date(Date.now() - DAY_MS)) throw startError();
  if (input.endsAt <= new Date()) {
    throw new ValidationError('Invalid schedule.', { endsAt: ['The end date is in the past.'] });
  }
  const row = await Banner.create({ ...input, priority: await Banner.countDocuments(), createdBy: actor.userId });
  const result = serializeBanner(row.toObject());
  await recordAudit({ action: 'cms.banner.create', subjectType: 'banner', subjectId: row._id, after: result, actor });
  return result;
}

export async function updateBanner(id, patch, actor) {
  const before = await Banner.findById(id).lean();
  if (!before) throw new NotFoundError('That banner no longer exists.');
  assertMedia({ kind: patch.kind ?? before.kind, images: patch.images ?? before.images, videoUrl: patch.videoUrl ?? before.videoUrl });
  assertCategoriesChosen({
    placements: patch.placements ?? before.placements,
    categoryIds: patch.categoryIds ?? before.categoryIds ?? [],
  });
  if (!isValidWindow(patch.startsAt ?? before.startsAt, patch.endsAt ?? before.endsAt)) throw windowError();
  // Only a changed start is checked: an already-running banner keeps its past start.
  if (patch.startsAt && patch.startsAt.getTime() !== before.startsAt.getTime() && patch.startsAt < new Date(Date.now() - DAY_MS)) throw startError();

  const updated = await Banner.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  if (!updated) throw new NotFoundError('That banner no longer exists.');
  const result = serializeBanner(updated);
  await recordAudit({ action: 'cms.banner.edit', subjectType: 'banner', subjectId: id, before: serializeBanner(before), after: result, actor });
  return result;
}

export async function deleteBanner(id, actor) {
  const removed = await Banner.findByIdAndDelete(id).lean();
  if (!removed) throw new NotFoundError('That banner no longer exists.');
  await recordAudit({ action: 'cms.banner.delete', subjectType: 'banner', subjectId: id, before: serializeBanner(removed), actor });
  return { id };
}

/** Customer app: banners running now for a placement (and, for CATEGORY_HERO, one category), best priority first. */
export async function listLiveBanners(placement, { categoryId = null, now = new Date() } = {}) {
  const rows = await Banner.find({
    placements: placement,
    ...(categoryId ? { categoryIds: categoryId } : {}),
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  })
    .sort({ priority: 1, _id: 1 })
    .lean();
  return rows.map((row) => ({ id: String(row._id), imageUrl: row.images.mobile_16_9 ? deviceUrl(row.images.mobile_16_9) : null, videoUrl: row.videoUrl ? deviceUrl(row.videoUrl) : null, altText: row.altText }));
}
