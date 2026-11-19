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
    altText: row.altText,
    placements: row.placements,
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

export async function createBanner(input, actor) {
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
