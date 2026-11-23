import { logger } from '../../../config/logger.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { attributeSetDetails } from '../../attribute/public/index.js';
import { getSizeChartForDisplay } from '../../catalog/public/index.js';
import { getCategoryForListing } from '../../category/public/index.js';
import { getSellerOwnerEmail, getSellerSummaries } from '../../identity/public/index.js';
import { urlForKey } from '../../media/public/index.js';
import { campaignByOffer } from './customerCatalog.service.js';
import { nextStatusForDecision } from '../domain/services/productRules.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { Variant } from '../infrastructure/persistence/variant.model.js';

const DECISION_EMAIL = {
  LIVE: (title) => ({ subject: `"${title}" is now live`, text: (t) => `Good news — "${title}" passed QC review and is now live for customers.` }),
  REJECTED: (title) => ({ subject: `"${title}" was rejected`, text: (t) => `"${title}" was rejected during QC review.\n\nReason: ${t}\n\nYou can create a new listing to try again.` }),
  NEEDS_CHANGES: (title) => ({ subject: `Changes requested on "${title}"`, text: (t) => `QC asked for changes on "${title}" before it can go live.\n\nReason: ${t}\n\nFix the listing and resubmit it for review.` }),
};

// The decision has already been saved by the time this runs — a flaky SMTP provider must
// not turn an already-successful decision into an error response (mirrors sellerApplications.routes.js).
async function notifySeller(sellerId, status, title, reason) {
  try {
    const to = await getSellerOwnerEmail(sellerId);
    if (!to) return;
    const email = DECISION_EMAIL[status](title);
    await sendMail({ to, subject: email.subject, text: email.text(reason) });
  } catch (error) {
    logger.error({ err: error, sellerId }, 'Listing decision notification email failed');
  }
}

const id = (value) => (value ? String(value) : null);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORT_FIELDS = ['title', 'status', 'createdAt', 'updatedAt'];

/** One row of the admin products table — a product with its offers rolled up, no fictional buy-box math. */
function serializeProductRow(product, offerStats, campaign = null) {
  const stats = offerStats ?? { count: 0, totalStock: 0, minPrice: null, maxPrice: null, assured: false };
  return {
    id: id(product._id),
    title: product.title,
    images: (product.images ?? []).map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
    brandName: product.brandName,
    categoryPath: product.categoryPath,
    status: product.status,
    campaign,
    minPricePaise: stats.minPrice,
    maxPricePaise: stats.maxPrice,
    totalStock: stats.totalStock,
    sellerCount: stats.count,
    assured: stats.assured,
    // No ratings or automated content-quality scoring module exists yet.
    rating: null,
    ratingCount: 0,
    contentScore: null,
    variantCount: undefined, // filled in only on the detail page; listing it here would need an extra join per row
    buyBoxSellerName: undefined,
  };
}

export async function listProductsForAdmin(query) {
  const filter = {};
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { brandName: pattern }];
  }
  if (query.status?.length) filter.status = { $in: query.status };

  const sortField = SORT_FIELDS.includes(query.sortField) ? query.sortField : 'updatedAt';
  const sort = { [sortField]: query.sortDirection, _id: 1 };
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Product.countDocuments(filter),
  ]);

  const productIds = products.map((p) => p._id);
  const offerStats = await Offer.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: '$productId',
        count: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        minPrice: { $min: '$sellingPricePaise' },
        maxPrice: { $max: '$sellingPricePaise' },
        assured: { $max: { $cond: ['$ariseAssured', 1, 0] } },
      },
    },
  ]);
  const liveOffers = await Offer.find({ productId: { $in: productIds }, status: 'LIVE' }).lean();
  const campaigns = await campaignByOffer(liveOffers);
  const campaignByProduct = new Map(liveOffers.filter((o) => campaigns.has(String(o._id))).map((o) => [id(o.productId), campaigns.get(String(o._id))]));
  const statsByProductId = new Map(offerStats.map((row) => [id(row._id), { ...row, assured: Boolean(row.assured) }]));

  return {
    data: products.map((product) => serializeProductRow(product, statsByProductId.get(id(product._id)), campaignByProduct.get(id(product._id)))),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

function allowedActionsFor(status) {
  return status === 'QC_PENDING' ? ['APPROVE', 'REJECT', 'NEEDS_CHANGES'] : [];
}

export async function getProductForAdmin(productId) {
  const product = await Product.findById(productId).lean();
  if (!product) throw new NotFoundError('That product does not exist.');

  const category = await getCategoryForListing(product.categoryId);
  const [variants, offers, { attributes }, sizeChart] = await Promise.all([
    Variant.find({ productId }).lean(),
    Offer.find({ productId }).lean(),
    attributeSetDetails(category?.attributeSetId ?? null),
    getSizeChartForDisplay(product.sizeChartId),
  ]);

  const [sellerById, campaigns] = await Promise.all([getSellerSummaries(offers.map((o) => o.sellerId)), campaignByOffer(offers.filter((o) => o.status === 'LIVE'))]);
  const variantById = new Map(variants.map((v) => [id(v._id), v]));
  const offerRows = offers.map((offer) => {
    const seller = sellerById.get(String(offer.sellerId));
    const priceAboveMrp = offer.sellingPricePaise > offer.mrpPaise;
    return {
      id: id(offer._id),
      variantId: id(offer.variantId),
      variantLabel: variantById.get(id(offer.variantId))?.label ?? offer.variantLabel,
      sellerId: offer.sellerId,
      sellerName: seller?.name ?? offer.sellerId,
      sellerStatus: seller?.status ?? null,
      sellingPricePaise: offer.sellingPricePaise,
      mrpPaise: offer.mrpPaise,
      priceAboveMrp,
      campaign: campaigns.get(id(offer._id)) ?? null,
      stock: offer.stock,
      fulfillmentType: offer.fulfillmentType,
      // No logistics SLA integration yet.
      dispatchSlaHours: null,
      status: offer.status,
      // With exactly one offer per variant per seller and no multi-seller attach flow yet,
      // the only live offer trivially wins the buy box — there is no competing candidate.
      buyBoxWinner: offer.status === 'LIVE',
    };
  });

  return {
    data: {
      id: id(product._id),
      title: product.title,
      status: product.status,
      assured: offerRows.some((o) => o.buyBoxWinner),
      brandName: product.brandName,
      categoryPath: product.categoryPath,
      images: (product.images ?? []).map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
      description: product.description,
      highlights: product.highlights,
      manufacturer: product.manufacturer,
      countryOfOrigin: product.countryOfOrigin,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate,
      contentScore: null,
      attributes: product.attributes,
      blockedReason: null,
      updatedAt: product.updatedAt,
    },
    meta: {
      variants: variants.map((v) => ({
        id: id(v._id),
        label: v.label,
        sku: v.sku,
        ean: v.ean,
        attributes: v.attributes,
        weightG: v.weightG,
        dimsCm: v.dimsCm,
        images: (v.images ?? []).map((key) => urlForKey(key, 'PRODUCT_IMAGE')),
      })),
      offers: offerRows,
      attributes,
      sizeChart,
      submission: product.status === 'QC_PENDING' ? { type: 'listing' } : null,
      allowedActions: allowedActionsFor(product.status),
    },
  };
}

export async function decideProduct(productId, action, { reason }, actor) {
  const nextStatus = nextStatusForDecision(action);
  if (!nextStatus) throw new ValidationError('Unknown decision.', { action: ['Unknown decision.'] });
  if (nextStatus !== 'LIVE' && !reason) {
    throw new ValidationError('Give a reason the seller will see.', { reason: ['Required for this decision.'] });
  }

  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('That product does not exist.');
  if (product.status !== 'QC_PENDING') {
    throw new ConflictError('ALREADY_DECIDED', 'This product has already been decided.');
  }

  const before = { status: product.status };
  product.status = nextStatus;
  product.reviewReason = nextStatus === 'LIVE' ? null : reason;
  await product.save();
  await Offer.updateMany({ productId }, { $set: { status: nextStatus, productStatus: nextStatus, reviewReason: product.reviewReason } });

  await recordAudit({
    action: `product.review.${action}`,
    subjectType: 'product',
    subjectId: productId,
    before,
    after: { status: nextStatus, reason: reason ?? null },
    reason: reason ?? null,
    actor,
  });

  await notifySeller(product.createdBySellerId, nextStatus, product.title, reason);

  return { id: id(product._id), status: nextStatus };
}

export async function deactivateOfferForAdmin(offerId, { reason }, actor) {
  if (!reason) throw new ValidationError('Give a reason.', { reason: ['Required.'] });
  const offer = await Offer.findOne({ _id: offerId, status: 'LIVE' });
  if (!offer) throw new NotFoundError('That offer is not live.');

  offer.status = 'INACTIVE';
  await offer.save();

  await recordAudit({
    action: 'offer.deactivate',
    subjectType: 'offer',
    subjectId: offerId,
    before: { status: 'LIVE' },
    after: { status: 'INACTIVE' },
    reason,
    actor,
  });
  return { id: id(offer._id), status: 'INACTIVE' };
}
