import { NotFoundError } from '../../../shared/errors/AppError.js';
import { getUnsellableSellerIds } from '../../identity/public/index.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { getLiveProductCards } from '../../product/public/index.js';
import { CAMPAIGN_STATUS as C, SUBMISSION_STATUS as S } from '../domain/constants/campaign.js';
import { Campaign } from '../infrastructure/persistence/campaign.model.js';
import { CampaignSubmission } from '../infrastructure/persistence/campaignSubmission.model.js';

// What customers see of a campaign: running (open/scheduled/active), inside its dates, and only admin-APPROVED entries whose product is still
// customer-visible. The deal price replaces the shelf price on these cards; a withdrawn or hidden product just drops out.
const TYPE_LABEL = { FLASH_DEAL: 'FLASH DEAL', OFFER: 'OFFER', SALE_EVENT: 'SALE EVENT', CLEARANCE: 'CLEARANCE' }; // the app tests the tag text
const ACCENT = { FLASH_DEAL: '#CC0C39', OFFER: '#7C3AED', SALE_EVENT: '#D97706', CLEARANCE: '#0F766E' };
const TILES_PER_PROMOTION = 6;
const HOME_PRODUCTS_PER_DEAL = 3;

// Open (still taking entries), scheduled and active campaigns all run on their dates; paused, ended, cancelled and draft ones never show.
const liveNow = (now) => ({ status: { $in: [C.OPEN, C.SCHEDULED, C.ACTIVE] }, startsAt: { $lte: now }, endsAt: { $gte: now } });

/** Per campaign id: its visible entries as cards at the deal price, best discount first. */
async function entriesByCampaign(campaignIds) {
  // A seller who may not sell right now (suspended, on holiday) takes their entries off the shelf too.
  const entries = await CampaignSubmission.find({ campaignId: { $in: campaignIds }, status: S.APPROVED, stockCommitted: { $gt: 0 }, sellerId: { $nin: await getUnsellableSellerIds() } })
    .sort({ discountPct: -1, _id: 1 })
    .lean();
  const cards = await getLiveProductCards(entries.map((entry) => entry.productId));
  const result = new Map(campaignIds.map((campaignId) => [String(campaignId), []]));
  for (const entry of entries) {
    const card = cards.get(entry.productId);
    if (!card) continue;
    result.get(String(entry.campaignId))?.push({
      id: String(entry._id),
      productId: entry.productId,
      name: card.name,
      brand: card.brand,
      imageUrl: card.imageUrl,
      pricePaise: Math.min(entry.dealPricePaise, card.pricePaise),
      mrpPaise: Math.max(entry.mrpPaise, card.mrpPaise),
      discountPct: entry.discountPct,
      rating: card.rating ?? null,
      ratingCount: card.ratingCount ?? 0,
    });
  }
  return result;
}

const promotionCard = (campaign, entries) => ({
  id: String(campaign._id),
  title: campaign.name,
  subtitle: campaign.tagline || 'Limited-time deals',
  tag: TYPE_LABEL[campaign.type],
  accent: campaign.gradient?.[0] ?? ACCENT[campaign.type],
  variant: 'gradient',
  gradient: campaign.gradient?.length === 2 ? campaign.gradient : null,
  backgroundImageUrl: deviceUrl(campaign.backgroundImageUrl),
  heroImageUrl: deviceUrl(campaign.heroImageUrl),
  startsAt: campaign.startsAt,
  endsAt: campaign.endsAt,
  couponCode: null,
  couponHint: null,
  items: entries.slice(0, TILES_PER_PROMOTION).map((entry) => ({
    id: entry.id, productId: entry.productId, imageUrl: entry.imageUrl, label: entry.name, bannerText: `${entry.discountPct}% off`,
  })),
});

const productCard = (entry) => ({
  id: entry.productId,
  name: entry.name,
  imageUrl: entry.imageUrl,
  pricePaise: entry.pricePaise,
  mrpPaise: entry.mrpPaise,
  rating: entry.rating,
  ratingCount: entry.ratingCount,
});

const flashSaleSummary = (campaign, entries) => ({
  id: String(campaign._id),
  title: campaign.name,
  subtitle: campaign.tagline || `Up to ${Math.max(...entries.map((entry) => entry.discountPct))}% off — grab it before it's gone`,
  endsAt: campaign.endsAt,
});

/** Every admin-chosen home flash sale that is running on its dates and has something to show, soonest-ending first. */
async function liveFlashSales(now) {
  const campaigns = await Campaign.find({ ...liveNow(now), homeFlashSale: true }).sort({ endsAt: 1 }).lean();
  if (!campaigns.length) return [];
  const entries = await entriesByCampaign(campaigns.map((campaign) => campaign._id));
  return campaigns.map((campaign) => ({ campaign, entries: entries.get(String(campaign._id)) })).filter(({ entries }) => entries.length);
}

/** The flash-sales list screen / anything else that needs just the banner summaries. */
export async function listFlashSales(now = new Date()) {
  return (await liveFlashSales(now)).map(({ campaign, entries }) => flashSaleSummary(campaign, entries));
}

/** Home page: one banner per live home flash sale, and one "Top Value Deals" card per live campaign placed there. */
export async function listHomeCampaignSections(now = new Date()) {
  const [flashSales, campaigns] = await Promise.all([
    liveFlashSales(now),
    Campaign.find({ ...liveNow(now), customerSection: 'TOP_VALUE_DEALS' }).sort({ endsAt: 1 }).lean(),
  ]);
  const entries = await entriesByCampaign(campaigns.map((campaign) => campaign._id));
  return {
    flashSales: flashSales.map(({ campaign, entries: flashEntries }) => flashSaleSummary(campaign, flashEntries)),
    topValueDeals: campaigns
      .filter((campaign) => entries.get(String(campaign._id)).length)
      .map((campaign) => {
        const list = entries.get(String(campaign._id));
        // A taste of the deal: a few of its own products; tapping one opens the deal with all of them.
        return {
          id: String(campaign._id),
          products: list.slice(0, HOME_PRODUCTS_PER_DEAL).map((entry) => ({
            id: entry.id, campaignId: String(campaign._id), imageUrl: entry.imageUrl, label: entry.name, value: `${entry.discountPct}% off`, tag: campaign.tagline || null,
          })),
        };
      }),
  };
}

/** The flash sale screen: one specific home flash sale, by the id its banner was tapped with. */
export async function getFlashSale(campaignId, now = new Date()) {
  const campaign = await Campaign.findOne({ _id: campaignId, ...liveNow(now), homeFlashSale: true }).lean();
  const entries = campaign && (await entriesByCampaign([campaign._id])).get(String(campaign._id));
  if (!campaign || !entries.length) throw new NotFoundError('That flash sale is not running right now.');
  return {
    id: String(campaign._id),
    title: campaign.name,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    items: entries.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      brand: entry.brand || 'Brand',
      name: entry.name,
      imageUrl: entry.imageUrl,
      pricePaise: entry.pricePaise,
      mrpPaise: entry.mrpPaise,
      discountPct: entry.discountPct,
    })),
  };
}

/** The Deals tab: every live campaign, whatever other place it is also shown (flash rail, Top Value Deals, ...). */
export async function listPromotions(now = new Date()) {
  const campaigns = await Campaign.find(liveNow(now)).sort({ endsAt: 1 }).lean();
  const entries = await entriesByCampaign(campaigns.map((campaign) => campaign._id));
  return campaigns.filter((campaign) => entries.get(String(campaign._id)).length).map((campaign) => promotionCard(campaign, entries.get(String(campaign._id))));
}

async function livePromotion(campaignId, now) {
  const campaign = await Campaign.findOne({ _id: campaignId, ...liveNow(now) }).lean();
  if (!campaign) throw new NotFoundError('That promotion is not running right now.');
  return { campaign, entries: (await entriesByCampaign([campaign._id])).get(String(campaign._id)) };
}

export async function getPromotion(campaignId, now = new Date()) {
  const { campaign, entries } = await livePromotion(campaignId, now);
  return { ...promotionCard(campaign, entries), relatedProducts: entries.map(productCard) }; // the deal page lists every product in the deal
}

export async function listPromotionProducts(campaignId, { cursor, limit }, now = new Date()) {
  const { entries } = await livePromotion(campaignId, now);
  return { items: entries.slice(cursor, cursor + limit).map(productCard), nextCursor: cursor + limit < entries.length ? String(cursor + limit) : null };
}

/**
 * The campaign deal price in force for each seller+product pair (keyed "sellerId:productId"): the lowest approved price
 * from a campaign running now, with the units still committed at that price. Pairs with no live deal are absent.
 * shortcut: committed units are read here but not held while a customer pays, so the last deal units can be oversold;
 * checkout must hold them (like stock) before the deal price is promised to more than one shopper.
 */
export async function getCampaignDealPrices(pairs, now = new Date()) {
  if (!pairs.length) return new Map();
  const campaigns = await Campaign.find(liveNow(now), 'name').lean();
  if (!campaigns.length) return new Map();
  const entries = await CampaignSubmission.find({
    campaignId: { $in: campaigns.map((campaign) => campaign._id) },
    status: S.APPROVED,
    stockCommitted: { $gt: 0 },
    $or: pairs.map(({ sellerId, productId }) => ({ sellerId, productId })),
  }).lean();
  const names = new Map(campaigns.map((campaign) => [String(campaign._id), campaign.name]));
  const best = new Map();
  for (const entry of entries) {
    const key = `${entry.sellerId}:${entry.productId}`;
    if (best.get(key)?.dealPricePaise <= entry.dealPricePaise) continue;
    best.set(key, {
      submissionId: String(entry._id),
      campaignId: String(entry.campaignId),
      campaignName: names.get(String(entry.campaignId)),
      dealPricePaise: entry.dealPricePaise,
      mrpPaise: entry.mrpPaise,
      remainingUnits: entry.stockCommitted,
    });
  }
  return best;
}

/**
 * The deal price of one variant: the campaign discounts the product by a fixed share of MRP (deal price / MRP at entry),
 * so each variant gets that same share off its own MRP instead of one flat price for all sizes.
 */
export const dealPriceForVariant = (deal, variantMrpPaise) => Math.round((variantMrpPaise * deal.dealPricePaise) / deal.mrpPaise);
