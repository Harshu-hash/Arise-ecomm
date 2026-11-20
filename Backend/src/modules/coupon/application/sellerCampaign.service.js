import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { listSellerCampaignProducts } from '../../product/public/index.js';
import { CAMPAIGN_STATUS as C, SUBMISSION_STATUS as S } from '../domain/constants/campaign.js';
import { Campaign } from '../infrastructure/persistence/campaign.model.js';
import { CampaignSubmission } from '../infrastructure/persistence/campaignSubmission.model.js';

const DUPLICATE_KEY = 11000;
const id = (value) => String(value);
const VISIBLE_TO_SELLERS = [C.OPEN, C.SCHEDULED, C.ACTIVE];
// A seller may re-enter a product whose earlier entry is over; a pending or approved one stands.
const REENTERABLE = [S.REJECTED, S.WITHDRAWN, S.NEEDS_CHANGES];
const WITHDRAWABLE = [S.PENDING, S.NEEDS_CHANGES, S.APPROVED];

/** Entries are accepted only while the admin is collecting them (OPEN) and before the deadline. */
export const acceptsEntries = (campaign, now = new Date()) =>
  campaign.status === C.OPEN && (!campaign.submissionDeadline || campaign.submissionDeadline > now);

const serializeCampaign = (row, mine) => ({
  id: id(row._id),
  name: row.name,
  type: row.type,
  status: row.status,
  customerSection: row.customerSection,
  tagline: row.tagline,
  minDiscountPct: row.minDiscountPct,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  submissionDeadline: row.submissionDeadline,
  acceptingEntries: acceptsEntries(row),
  myProducts: mine?.total ?? 0,
  myLiveProducts: mine?.approved ?? 0,
});

const serializeEntry = (row) => ({
  id: id(row._id),
  campaignId: id(row.campaignId),
  listingId: row.productId, // the product, as the seller's listing picker knows it
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
  feedback: row.rejectionReason, // the reviewer's note (reject / needs changes)
});

async function myCounts(sellerId, campaignIds) {
  const rows = await CampaignSubmission.aggregate([
    { $match: { sellerId, campaignId: { $in: campaignIds }, status: { $ne: S.WITHDRAWN } } },
    { $group: { _id: '$campaignId', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', S.APPROVED] }, 1, 0] } } } },
  ]);
  return new Map(rows.map((row) => [id(row._id), row]));
}

async function findVisible(sellerId, campaignId) {
  const campaign = await Campaign.findById(campaignId).lean();
  const entered = campaign && campaign.status !== C.DRAFT && !VISIBLE_TO_SELLERS.includes(campaign.status)
    ? await CampaignSubmission.exists({ campaignId, sellerId })
    : false;
  if (!campaign || campaign.status === C.DRAFT || (!VISIBLE_TO_SELLERS.includes(campaign.status) && !entered)) {
    throw new NotFoundError('That campaign is not available.');
  }
  return campaign;
}

/** Campaigns the admin published: running or joinable ones, plus any past one this seller took part in. */
export async function listSellerCampaigns(sellerId, { q, type, tab }) {
  const now = new Date();
  const joinedIds = (await CampaignSubmission.distinct('campaignId', { sellerId, status: { $ne: S.WITHDRAWN } }));
  const filter = {
    $and: [
      { $or: [{ status: { $in: VISIBLE_TO_SELLERS } }, { _id: { $in: joinedIds }, status: { $ne: C.DRAFT } }] },
      ...(q ? [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] : []),
      ...(type.length ? [{ type: { $in: type } }] : []),
      ...(tab === 'open' ? [{ status: C.OPEN, $or: [{ submissionDeadline: null }, { submissionDeadline: { $gt: now } }] }] : []),
      ...(tab === 'joined' ? [{ _id: { $in: joinedIds } }] : []),
    ],
  };
  const rows = await Campaign.find(filter).lean();
  rows.sort((a, b) => (a.submissionDeadline ?? a.endsAt) - (b.submissionDeadline ?? b.endsAt));
  const counts = await myCounts(sellerId, rows.map((row) => row._id));
  return { data: rows.map((row) => serializeCampaign(row, counts.get(id(row._id)))), meta: { total: rows.length } };
}

export async function getSellerCampaign(sellerId, campaignId) {
  const campaign = await findVisible(sellerId, campaignId);
  return serializeCampaign(campaign, (await myCounts(sellerId, [campaign._id])).get(id(campaign._id)));
}

export async function listMyEntries(sellerId, campaignId, { page, pageSize }) {
  await findVisible(sellerId, campaignId);
  const filter = { campaignId, sellerId };
  const [rows, total] = await Promise.all([
    CampaignSubmission.find(filter).sort({ submittedAt: -1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    CampaignSubmission.countDocuments(filter),
  ]);
  return { data: rows.map(serializeEntry), meta: { total, page, pageSize } };
}

/** The seller's live products not already in this campaign (a pending or approved entry blocks, an over one does not). */
export async function listEligibleProducts(sellerId, campaignId) {
  await findVisible(sellerId, campaignId);
  const [products, standing] = await Promise.all([
    listSellerCampaignProducts(sellerId),
    CampaignSubmission.find({ campaignId, sellerId, status: { $in: [S.PENDING, S.APPROVED] } }, 'productId').lean(),
  ]);
  const taken = new Set(standing.map((row) => row.productId));
  return products.filter((product) => !taken.has(product.id));
}

/** Enters products into a campaign. All-or-nothing validation first, so a bad row never leaves a half-filed batch. */
export async function submitEntries(sellerId, campaignId, entries) {
  const campaign = await findVisible(sellerId, campaignId);
  if (!acceptsEntries(campaign)) throw new ConflictError('ENTRIES_CLOSED', 'This campaign is no longer accepting entries.');

  const productIds = entries.map((entry) => entry.listingId);
  if (new Set(productIds).size !== productIds.length) throw new ValidationError('Duplicate products.', { entries: ['List each product once.'] });
  const [products, existing, summaries] = await Promise.all([
    listSellerCampaignProducts(sellerId, productIds),
    CampaignSubmission.find({ campaignId, sellerId, productId: { $in: productIds } }).lean(),
    getSellerSummaries([sellerId]),
  ]);
  const byProduct = new Map(products.map((product) => [product.id, product]));
  const priorByProduct = new Map(existing.map((row) => [row.productId, row]));

  const prepared = entries.map((entry, index) => {
    const fail = (message) => new ValidationError(message, { [`entries.${index}`]: [message] });
    const product = byProduct.get(entry.listingId);
    if (!product) throw fail('Choose one of your live products.');
    if (priorByProduct.has(entry.listingId) && !REENTERABLE.includes(priorByProduct.get(entry.listingId).status)) {
      throw fail(`"${product.title}" is already in this campaign.`);
    }
    if (entry.dealPricePaise > product.sellingPricePaise) throw fail('The deal price cannot be above your current selling price.');
    if (entry.stockCommitted > product.stock) throw fail(`You only have ${product.stock} in stock.`);
    const discountPct = Math.round(((product.mrpPaise - entry.dealPricePaise) / product.mrpPaise) * 100);
    if (discountPct < campaign.minDiscountPct) throw fail(`The discount must be at least ${campaign.minDiscountPct}% off MRP.`);
    return {
      product,
      prior: priorByProduct.get(entry.listingId) ?? null,
      fields: {
        productTitle: product.title,
        brand: product.brand,
        imageUrl: product.imageUrl,
        mrpPaise: product.mrpPaise,
        dealPricePaise: entry.dealPricePaise,
        discountPct,
        stockCommitted: entry.stockCommitted,
        status: S.PENDING,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewerId: null,
        reviewer: null,
        rejectionReason: null,
      },
    };
  });

  const saved = [];
  for (const { product, prior, fields } of prepared) {
    try {
      if (prior) {
        // Guarded on the status we validated, so a concurrent decision cannot be overwritten.
        const updated = await CampaignSubmission.findOneAndUpdate({ _id: prior._id, status: prior.status }, { $set: fields }, { new: true }).lean();
        if (!updated) throw new ConflictError('CONFLICT', `"${product.title}" changed while you were submitting. Try again.`);
        saved.push(updated);
      } else {
        const created = await CampaignSubmission.create({ campaignId, sellerId, sellerName: summaries.get(sellerId)?.name ?? 'Seller', productId: product.id, ...fields });
        saved.push(created.toObject());
      }
    } catch (error) {
      if (error?.code === DUPLICATE_KEY) throw new ConflictError('ALREADY_ENTERED', `"${product.title}" is already in this campaign.`);
      throw error;
    }
  }
  return saved.map(serializeEntry);
}

export async function withdrawEntry(sellerId, entryId) {
  const entry = await CampaignSubmission.findOne({ _id: entryId, sellerId }).lean();
  if (!entry) throw new NotFoundError('That entry is not on your account.');
  const campaign = await Campaign.findById(entry.campaignId, 'status').lean();
  if ([C.ENDED, C.CANCELLED].includes(campaign?.status)) throw new ConflictError('CAMPAIGN_CLOSED', 'This campaign has closed, so its entries can no longer change.');
  const updated = await CampaignSubmission.findOneAndUpdate(
    { _id: entryId, sellerId, status: { $in: WITHDRAWABLE } },
    { $set: { status: S.WITHDRAWN } },
    { new: true },
  ).lean();
  if (!updated) throw new ConflictError('NOT_WITHDRAWABLE', 'Only a pending, approved or changes-requested entry can be withdrawn.');
  return serializeEntry(updated);
}
