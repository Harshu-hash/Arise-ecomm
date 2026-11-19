import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { CAMPAIGN_TRANSITIONS, REVIEWABLE_STATUSES, SUBMISSION_DECISIONS, SUBMISSION_STATUS } from '../domain/constants/campaign.js';
import { canTransition, windowErrors } from '../domain/services/campaignRules.js';
import { Campaign } from '../infrastructure/persistence/campaign.model.js';
import { CampaignSubmission } from '../infrastructure/persistence/campaignSubmission.model.js';

// Clock-skew / request-latency allowance when comparing a picked start time with "now".
const START_GRACE_MS = 5 * 60 * 1000;
const startError = () => new ValidationError('Invalid schedule.', { startsAt: ['The start is in the past.'] });
const isPastStart = (startsAt) => startsAt < new Date(Date.now() - START_GRACE_MS);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchPattern = (q) => new RegExp(escapeRegex(q), 'i');
const totalPages = (total, pageSize) => Math.max(1, Math.ceil(total / pageSize));
const toCounts = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));

// Entry counters are derived from submissions: two grouped reads for the whole page of campaigns.
async function entryStats(campaignIds) {
  const ids = campaignIds.map((id) => new mongoose.Types.ObjectId(id));
  const [byStatus, sellers] = await Promise.all([
    CampaignSubmission.aggregate([
      { $match: { campaignId: { $in: ids } } },
      { $group: { _id: { campaignId: '$campaignId', status: '$status' }, count: { $sum: 1 } } },
    ]),
    CampaignSubmission.aggregate([
      { $match: { campaignId: { $in: ids } } },
      { $group: { _id: '$campaignId', sellers: { $addToSet: '$sellerId' } } },
    ]),
  ]);
  const stats = new Map(campaignIds.map((id) => [id, { PENDING: 0, APPROVED: 0, REJECTED: 0, sellers: 0 }]));
  for (const row of byStatus) {
    const entry = stats.get(String(row._id.campaignId));
    if (entry) entry[row._id.status] = row.count;
  }
  for (const row of sellers) {
    const entry = stats.get(String(row._id));
    if (entry) entry.sellers = row.sellers.length;
  }
  return stats;
}

function serializeCampaign(row, stats) {
  return {
    id: String(row._id),
    name: row.name,
    type: row.type,
    status: row.status,
    customerSection: row.customerSection,
    tagline: row.tagline,
    minDiscountPct: row.minDiscountPct,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    submissionDeadline: row.submissionDeadline,
    createdAt: row.createdAt,
    sellersJoined: stats.sellers,
    pendingCount: stats.PENDING,
    approvedCount: stats.APPROVED,
    rejectedCount: stats.REJECTED,
  };
}

function serializeSubmission(row) {
  return {
    id: String(row._id),
    campaignId: String(row.campaignId),
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    productId: row.productId,
    productTitle: row.productTitle,
    brand: row.brand,
    imageUrl: row.imageUrl,
    mrpPaise: row.mrpPaise,
    dealPricePaise: row.dealPricePaise,
    discountPct: row.discountPct,
    stockCommitted: row.stockCommitted,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewer: row.reviewer,
    rejectionReason: row.rejectionReason,
  };
}

async function findCampaign(id) {
  const campaign = await Campaign.findById(id).lean();
  if (!campaign) throw new NotFoundError('That campaign no longer exists.');
  return campaign;
}

const withStats = async (row) => serializeCampaign(row, (await entryStats([String(row._id)])).get(String(row._id)));

export async function listCampaigns({ page, pageSize, q, type, status, sortField, sortDirection }) {
  const base = {
    ...(q ? { $or: [{ name: searchPattern(q) }, { tagline: searchPattern(q) }] } : {}),
    ...(type.length ? { type: { $in: type } } : {}),
  };
  const filter = status.length ? { ...base, status: { $in: status } } : base;
  const [rows, total, facets] = await Promise.all([
    Campaign.find(filter).sort({ [sortField]: sortDirection, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Campaign.countDocuments(filter),
    // Tab badges ignore the status filter so every tab keeps its own count.
    Campaign.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const stats = await entryStats(rows.map((row) => String(row._id)));
  return {
    data: rows.map((row) => serializeCampaign(row, stats.get(String(row._id)))),
    meta: { page, pageSize, total, totalPages: totalPages(total, pageSize), facets: { status: toCounts(facets) } },
  };
}

export async function getCampaign(id) {
  return withStats(await findCampaign(id));
}

export async function createCampaign(input, actor) {
  const errors = windowErrors(input);
  if (errors) throw new ValidationError('Invalid schedule.', errors);
  if (isPastStart(input.startsAt)) throw startError();
  if (input.endsAt <= new Date()) throw new ValidationError('Invalid schedule.', { endsAt: ['The end is in the past.'] });
  const row = await Campaign.create({ ...input, createdBy: actor.userId });
  const result = await withStats(row.toObject());
  await recordAudit({ action: 'marketing.campaign.create', subjectType: 'promoCampaign', subjectId: row._id, after: result, actor });
  return result;
}

export async function updateCampaign(id, patch, actor) {
  const before = await findCampaign(id);
  if (CAMPAIGN_TRANSITIONS[before.status].length === 0) {
    throw new ConflictError('CAMPAIGN_CLOSED', 'An ended or cancelled campaign cannot be edited.');
  }
  const errors = windowErrors({ ...before, ...patch });
  if (errors) throw new ValidationError('Invalid schedule.', errors);
  // Only a changed start is checked: a running campaign keeps its past start.
  if (patch.startsAt && patch.startsAt.getTime() !== before.startsAt.getTime() && isPastStart(patch.startsAt)) throw startError();

  // Guarded on status so an edit cannot land on a campaign that just closed.
  const updated = await Campaign.findOneAndUpdate({ _id: id, status: before.status }, { $set: patch }, { new: true }).lean();
  if (!updated) throw new ConflictError('CONFLICT', 'The campaign changed while you were editing it.');
  const result = await withStats(updated);
  await recordAudit({ action: 'marketing.campaign.edit', subjectType: 'promoCampaign', subjectId: id, before: serializeCampaign(before, {}), after: result, actor });
  return result;
}

export async function changeCampaignStatus(id, to, actor) {
  const before = await findCampaign(id);
  const illegal = () => new ConflictError('ILLEGAL_TRANSITION', `A ${before.status} campaign cannot move to ${to}.`);
  if (!canTransition(before.status, to)) throw illegal();
  const updated = await Campaign.findOneAndUpdate({ _id: id, status: before.status }, { $set: { status: to } }, { new: true }).lean();
  if (!updated) throw illegal();
  await recordAudit({ action: 'marketing.campaign.status', subjectType: 'promoCampaign', subjectId: id, before: { status: before.status }, after: { status: to }, actor });
  return withStats(updated);
}

export async function listSubmissions(campaignId, { page, pageSize, q, status, sortField, sortDirection }) {
  await findCampaign(campaignId);
  const base = {
    campaignId,
    ...(q ? { $or: [{ productTitle: searchPattern(q) }, { sellerName: searchPattern(q) }, { brand: searchPattern(q) }] } : {}),
  };
  const filter = status.length ? { ...base, status: { $in: status } } : base;
  const [rows, total, facets] = await Promise.all([
    CampaignSubmission.find(filter).sort({ [sortField]: sortDirection, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    CampaignSubmission.countDocuments(filter),
    CampaignSubmission.aggregate([
      { $match: { ...base, campaignId: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  return {
    data: rows.map(serializeSubmission),
    meta: { page, pageSize, total, totalPages: totalPages(total, pageSize), facets: { status: toCounts(facets) } },
  };
}

// Decides many entries at once. Only still-PENDING entries move, and approval additionally needs the
// campaign's minimum discount, so a stale selection or a below-floor entry is skipped, never forced through.
export async function decideSubmissions(campaignId, { submissionIds, decision, reason }, actor) {
  const campaign = await findCampaign(campaignId);
  if (!REVIEWABLE_STATUSES.includes(campaign.status)) {
    throw new ConflictError('CAMPAIGN_NOT_REVIEWABLE', 'Entries can be reviewed only while the campaign is open, scheduled or live.');
  }
  const approving = decision === 'approve';
  if (!approving && !reason) throw new ValidationError('Give a reason.', { reason: ['Tell the seller why.'] });

  const result = await CampaignSubmission.updateMany(
    {
      _id: { $in: submissionIds },
      campaignId,
      status: SUBMISSION_STATUS.PENDING,
      ...(approving ? { discountPct: { $gte: campaign.minDiscountPct } } : {}),
    },
    {
      $set: {
        status: SUBMISSION_DECISIONS[decision],
        reviewedAt: new Date(),
        reviewerId: actor.userId,
        reviewer: actor.name ?? null,
        rejectionReason: approving ? null : reason,
      },
    },
  );
  const updated = result.modifiedCount;
  if (!updated) {
    throw new ConflictError(
      'NOTHING_TO_DECIDE',
      approving ? 'Those entries are no longer pending or are below the minimum discount.' : 'Those entries are no longer pending.',
    );
  }
  await recordAudit({
    action: `marketing.campaign.entries_${decision}`,
    subjectType: 'promoCampaign',
    subjectId: campaignId,
    after: { submissionIds, updated },
    reason: reason ?? null,
    actor,
  });
  return { updated, skipped: submissionIds.length - updated };
}
