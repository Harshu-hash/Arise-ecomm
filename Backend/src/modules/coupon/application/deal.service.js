import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { getShelfPrices } from '../../product/public/index.js';
import { dealErrors, dealStatus, dealStatusExpr, istDate, slotError } from '../domain/services/dealRules.js';
import { Deal } from '../infrastructure/persistence/deal.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (errors) => new ValidationError('Invalid deal.', errors);
const slotTaken = () => new ConflictError('SLOT_TAKEN', 'That day already has a deal in this slot. Reschedule the existing one first.');
const DUPLICATE_KEY = 11000;

function serializeDeal(row, now = new Date()) {
  return {
    id: String(row._id),
    title: row.title,
    label: row.label,
    tag: row.tag,
    productId: String(row.productId),
    sellerId: row.sellerId,
    mrpPaise: row.mrpPaise,
    dealPricePaise: row.dealPricePaise,
    placement: row.placement,
    slotDate: row.slotDate,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: dealStatus(row, now),
    createdAt: row.createdAt,
  };
}

async function findDeal(id) {
  const deal = await Deal.findById(id).lean();
  if (!deal) throw new NotFoundError('That deal no longer exists.');
  return deal;
}

export async function listDeals({ page, pageSize, q, placement, tag, status, sortField, sortDirection }) {
  const now = new Date();
  const base = q ? { $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { label: new RegExp(escapeRegex(q), 'i') }] } : {};
  const filters = {
    ...(placement ? { placement } : {}),
    ...(tag.length ? { tag: { $in: tag } } : {}),
    ...(status.length ? { status: { $in: status } } : {}),
  };
  const [result] = await Deal.aggregate([
    { $match: base },
    { $addFields: { status: dealStatusExpr(now) } },
    {
      $facet: {
        rows: [{ $match: filters }, { $sort: { [sortField]: sortDirection, _id: 1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        total: [{ $match: filters }, { $count: 'n' }],
        status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        placement: [{ $group: { _id: '$placement', count: { $sum: 1 } } }],
        tag: [{ $group: { _id: '$tag', count: { $sum: 1 } } }],
      },
    },
  ]);
  const total = result.total[0]?.n ?? 0;
  const toMap = (items) => Object.fromEntries(items.map((item) => [item._id, item.count]));
  return {
    data: result.rows.map((row) => serializeDeal(row, now)),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets: { status: toMap(result.status), placement: toMap(result.placement), tag: toMap(result.tag) },
    },
  };
}

/** Deal of the Day calendar: every deal holding a slot from today on, soonest first. */
export async function listCalendar() {
  const rows = await Deal.find({ slotDate: { $gte: istDate() } }).sort({ slotDate: 1, placement: 1 }).limit(200).lean();
  return rows.map((row) => serializeDeal(row));
}

export async function createDeal(input, actor) {
  const shelf = (await getShelfPrices([input.productId])).get(input.productId);
  if (!shelf) throw fail({ productId: ['This product has no live offer to build a deal on.'] });
  const errors = dealErrors({ ...input, shelfPricePaise: shelf.pricePaise });
  if (errors) throw fail(errors);
  let row;
  try {
    row = await Deal.create({ ...input, offerId: shelf.offerId, sellerId: shelf.sellerId, mrpPaise: shelf.mrpPaise, createdBy: actor.userId });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw slotTaken();
    throw error;
  }
  const result = serializeDeal(row.toObject());
  await recordAudit({ action: 'marketing.deal.create', subjectType: 'deal', subjectId: row._id, after: result, actor });
  return result;
}

/**
 * Moves a deal to another Deal-of-the-Day day. If another deal already holds that day the two swap, as long as the
 * other deal can legally run on the vacated day. Steps are ordered so the unique slot index is never violated midway.
 */
export async function rescheduleDeal(id, slotDate, actor) {
  const deal = await findDeal(id);
  const message = slotError(slotDate, deal);
  if (message) throw fail({ slotDate: [message] });
  if (deal.slotDate === slotDate) return { moved: serializeDeal(deal), swappedWith: null };

  const clash = await Deal.findOne({ _id: { $ne: deal._id }, placement: deal.placement, slotDate }).lean();
  if (clash && (!deal.slotDate || slotError(deal.slotDate, clash))) throw slotTaken();

  try {
    if (clash) {
      await Deal.updateOne({ _id: deal._id }, { $set: { slotDate: null } });
      await Deal.updateOne({ _id: clash._id }, { $set: { slotDate: deal.slotDate } });
    }
    await Deal.updateOne({ _id: deal._id }, { $set: { slotDate } });
  } catch (error) {
    await Deal.updateOne({ _id: deal._id, slotDate: null }, { $set: { slotDate: deal.slotDate } }); // best-effort undo of the vacate step
    if (error?.code === DUPLICATE_KEY) throw slotTaken();
    throw error;
  }
  const [moved, swapped] = await Promise.all([Deal.findById(deal._id).lean(), clash ? Deal.findById(clash._id).lean() : null]);
  await recordAudit({
    action: 'marketing.deal.reschedule',
    subjectType: 'deal',
    subjectId: id,
    before: { slotDate: deal.slotDate },
    after: { slotDate, swappedWith: clash ? String(clash._id) : null },
    actor,
  });
  return { moved: serializeDeal(moved), swappedWith: swapped ? serializeDeal(swapped) : null };
}

export async function deleteDeal(id, actor) {
  const removed = await Deal.findByIdAndDelete(id).lean();
  if (!removed) throw new NotFoundError('That deal no longer exists.');
  await recordAudit({ action: 'marketing.deal.delete', subjectType: 'deal', subjectId: id, before: serializeDeal(removed), actor });
  return { id };
}
