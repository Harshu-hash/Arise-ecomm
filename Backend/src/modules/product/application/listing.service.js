import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { attributeSetDetails } from '../../attribute/public/index.js';
import {
  findBrandForListing,
  findSizeChartForListing,
  incrementBrandUsage,
  incrementSizeChartUsage,
} from '../../catalog/public/index.js';
import { getCategoryForListing, incrementCategoryProductCount } from '../../category/public/index.js';
import { resolveMediaKeys, urlForKey } from '../../media/public/index.js';
import {
  buildVariantSpecs,
  generateSku,
  validatePricing,
  validateProductAttributeValues,
  validateVariantAttributeValues,
  validateVariantCombinations,
  variantDefiningCodes,
} from '../domain/services/productRules.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { Variant } from '../infrastructure/persistence/variant.model.js';

const id = (value) => (value ? String(value) : null);
const DUPLICATE_KEY = 11000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What the seller sees while admin QC has (or had) an opinion on their listing — why, and since when. */
function buildSubmission(status, reviewReason, updatedAt) {
  if (!['QC_PENDING', 'NEEDS_CHANGES'].includes(status)) return null;
  return {
    status,
    issues: reviewReason ? [reviewReason] : [],
    ageHours: Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 3_600_000)),
  };
}

/** One listing row from the seller's point of view: their offer joined with its product/variant. */
export function serializeListing(offer, product, variant) {
  return {
    id: id(offer._id),
    productId: id(product._id),
    variantId: id(variant._id),
    productTitle: product.title,
    productImage: urlForKey(product.images?.[0], 'PRODUCT_IMAGE'),
    brandName: product.brandName,
    categoryPath: product.categoryPath,
    variantLabel: variant.label,
    sku: variant.sku,
    sellerSku: offer.sellerSku,
    taxCode: offer.taxCode,
    sellingPricePaise: offer.sellingPricePaise,
    mrpPaise: offer.mrpPaise,
    stock: offer.stock,
    status: offer.status,
    productStatus: product.status,
    fulfillmentType: offer.fulfillmentType,
    buyBoxWinner: offer.buyBoxWinner,
    ariseAssured: offer.ariseAssured,
    reviewReason: product.reviewReason ?? null,
    submission: buildSubmission(product.status, product.reviewReason, product.updatedAt),
    needsChanges: product.status === 'NEEDS_CHANGES',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * The same row shape as `serializeListing`, but read entirely off the Offer's own
 * denormalized snapshot — no Product/Variant join, so the seller's listing table can
 * page through this cheaply.
 */
export function serializeListingRow(offer) {
  return {
    id: id(offer._id),
    productId: id(offer.productId),
    variantId: id(offer.variantId),
    productTitle: offer.productTitle,
    productImage: offer.productImage,
    brandName: offer.brandName,
    categoryPath: offer.categoryPath,
    variantLabel: offer.variantLabel,
    sku: offer.sku,
    sellerSku: offer.sellerSku,
    taxCode: offer.taxCode,
    sellingPricePaise: offer.sellingPricePaise,
    mrpPaise: offer.mrpPaise,
    stock: offer.stock,
    status: offer.status,
    productStatus: offer.productStatus,
    fulfillmentType: offer.fulfillmentType,
    buyBoxWinner: offer.buyBoxWinner,
    ariseAssured: offer.ariseAssured,
    reviewReason: offer.reviewReason ?? null,
    submission: buildSubmission(offer.productStatus, offer.reviewReason, offer.updatedAt),
    needsChanges: offer.productStatus === 'NEEDS_CHANGES',
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

function mediaError(field) {
  return new ValidationError('Upload media before saving the listing.', { [field]: ['Upload media before saving the listing.'] });
}

/** Turns media IDs into their durable storage keys, or rejects if any don't resolve. */
async function resolveOrThrow(mediaIds, kinds, field, sellerId) {
  const { keys, missing } = await resolveMediaKeys(mediaIds, { ownerId: sellerId, kinds });
  if (missing.length) throw mediaError(field);
  return keys;
}

/**
 * Validates a seller's "add product" request against its category's catalog rules and
 * shapes it into what `createListing` will write. Read-only — throws on the first
 * problem found, touches no collection.
 */
async function prepareListing(body, sellerId) {
  const category = await getCategoryForListing(body.categoryId);
  if (!category) throw new ValidationError('Category not found.', { categoryId: ['Choose a valid category.'] });

  const { attributes: allAttrs } = await attributeSetDetails(category.attributeSetId, { activeOnly: true });
  const plainDefs = allAttrs.filter((a) => !a.variantDefining);
  const variantDefs = allAttrs.filter((a) => a.variantDefining);

  const { errors: attrErrors, clean: cleanAttributes } = validateProductAttributeValues(body.attributes, plainDefs);
  if (Object.keys(attrErrors).length) throw new ValidationError('Invalid category attributes.', attrErrors);

  let brand = null;
  if (body.brandId) {
    brand = await findBrandForListing(body.brandId);
    if (!brand) throw new ValidationError('Brand not found.', { brandId: ['Choose a valid brand.'] });
  }

  let sizeChartId = null;
  if (body.sizeChartId) {
    sizeChartId = await findSizeChartForListing(body.sizeChartId, category.id);
    if (!sizeChartId) throw new ValidationError('Size chart not found.', { sizeChartId: ['Choose a size chart that belongs to this category.'] });
  }

  const isDraft = body.status === 'DRAFT';
  if (!isDraft && !body.manufacturer?.trim()) {
    throw new ValidationError('Manufacturer is required.', { manufacturer: ['Enter the manufacturer name and address.'] });
  }

  const specs = buildVariantSpecs(body);
  const variantCodes = variantDefiningCodes(variantDefs);

  const fieldErrors = {
    ...validatePricing(specs, isDraft),
    ...validateVariantCombinations(specs, variantCodes),
    ...validateVariantAttributeValues(specs, variantDefs),
  };
  if (Object.keys(fieldErrors).length) throw new ValidationError('Invalid listing.', fieldErrors);

  const [images, videos, complianceDocuments, resolvedSpecs] = await Promise.all([
    resolveOrThrow(body.images, ['PRODUCT_IMAGE'], 'images', sellerId),
    resolveOrThrow(body.videos, ['PRODUCT_VIDEO'], 'videos', sellerId),
    resolveOrThrow(body.complianceDocuments, ['PRODUCT_COMPLIANCE'], 'complianceDocuments', sellerId),
    Promise.all(specs.map(async (spec) => ({
      ...spec,
      images: await resolveOrThrow(spec.images, ['PRODUCT_IMAGE'], 'images', sellerId),
    }))),
  ]);

  return { category, brand, sizeChartId, isDraft, specs: resolvedSpecs, cleanAttributes, images, videos, complianceDocuments };
}

export async function createListing(body, { sellerId, actor }) {
  const { category, brand, sizeChartId, isDraft, specs, cleanAttributes, images, videos, complianceDocuments } =
    await prepareListing(body, sellerId);

  const product = new Product({
    title: body.title.trim(),
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    categoryId: category.id,
    categoryPath: category.path,
    rootCategoryId: category.rootId,
    status: isDraft ? 'DRAFT' : 'QC_PENDING',
    description: body.description?.trim() ?? '',
    highlights: body.highlights ?? [],
    attributes: cleanAttributes,
    fit: body.fit?.trim() || null,
    care: body.care?.trim() || null,
    modelInfo: body.modelInfo?.trim() || null,
    manufacturer: body.manufacturer?.trim() || null,
    countryOfOrigin: body.countryOfOrigin?.trim() || 'India',
    productCode: body.productCode?.trim() || null,
    images,
    videos,
    complianceDocuments,
    hsnCode: category.hsnCode,
    gstRate: category.gstRate,
    sizeChartId,
    returnPolicy: {
      windowDays: body.returnPolicy?.windowDays ?? category.returnWindowDays,
      type: body.returnPolicy?.type ?? (category.returnTypes?.length ? 'RETURN' : 'NONE'),
    },
    createdBySellerId: sellerId,
  });
  await product.save();

  const variants = [];
  const offers = [];
  try {
    for (const [index, spec] of specs.entries()) {
      const sku = generateSku({ custom: spec.sku, brandName: brand?.name, productId: product._id, index });
      let variant;
      try {
        variant = await new Variant({
          productId: product._id,
          sku,
          ean: spec.barcode,
          attributes: spec.attributes,
          label: spec.label ?? (specs.length > 1 ? Object.values(spec.attributes ?? {}).join(' · ') : 'Default'),
          images: spec.images,
          weightG: spec.weightG,
          dimsCm: spec.dimsCm,
        }).save();
      } catch (error) {
        if (error?.code === DUPLICATE_KEY) {
          throw new ValidationError('That SKU is already in use.', { sku: ['Choose a different SKU.'] });
        }
        throw error;
      }
      variants.push(variant);

      const offer = await new Offer({
        productId: product._id,
        variantId: variant._id,
        sellerId,
        sellerSku: spec.sellerSku ?? sku,
        sellingPricePaise: spec.sellingPricePaise ?? 0,
        mrpPaise: spec.mrpPaise ?? 0,
        taxCode: spec.taxCode ?? category.hsnCode,
        stock: spec.stock ?? 0,
        fulfillmentType: body.fulfillmentType === 'ARISE' ? 'ARISE' : 'SELLER',
        status: isDraft ? 'DRAFT' : 'QC_PENDING',
        productTitle: product.title,
        productImage: urlForKey(product.images?.[0], 'PRODUCT_IMAGE'),
        brandName: product.brandName,
        categoryPath: product.categoryPath,
        variantLabel: variant.label,
        sku: variant.sku,
        productStatus: product.status,
      }).save();
      offers.push(offer);
    }
  } catch (error) {
    // Nothing commits partway through a failed listing — mirrors the reserve/release
    // compensation pattern category.service.js uses for attribute-set reservation.
    await Promise.all([
      Variant.deleteMany({ _id: { $in: variants.map((v) => v._id) } }),
      Offer.deleteMany({ _id: { $in: offers.map((o) => o._id) } }),
      Product.deleteOne({ _id: product._id }),
    ]);
    throw error;
  }

  await Promise.all([
    incrementCategoryProductCount(category.id, 1),
    brand ? incrementBrandUsage(brand.id, { products: 1, listings: offers.length }) : null,
    sizeChartId ? incrementSizeChartUsage(sizeChartId, 1) : null,
  ]);

  const result = serializeListing(offers[0], product, variants[0]);
  await recordAudit({
    action: 'listing.create',
    subjectType: 'product',
    subjectId: product._id,
    after: result,
    actor,
  });
  return result;
}

export async function getListingForSeller(offerId, sellerId) {
  const offer = await Offer.findOne({ _id: offerId, sellerId }).lean();
  if (!offer) throw new NotFoundError('That listing does not exist on your account.');
  const [product, variant] = await Promise.all([
    Product.findById(offer.productId).lean(),
    Variant.findById(offer.variantId).lean(),
  ]);
  if (!product || !variant) throw new NotFoundError('That listing does not exist on your account.');
  return serializeListing(offer, product, variant);
}

/** Seller fixes what admin flagged and sends a NEEDS_CHANGES listing back into the QC queue. */
export async function resubmitListing(offerId, { sellerId, actor }) {
  const offer = await Offer.findOne({ _id: offerId, sellerId }).lean();
  if (!offer) throw new NotFoundError('That listing does not exist on your account.');
  const product = await Product.findById(offer.productId);
  if (!product) throw new NotFoundError('That listing does not exist on your account.');
  if (product.status !== 'NEEDS_CHANGES') {
    throw new ConflictError('NOT_RESUBMITTABLE', 'Only a listing QC asked for changes on can be resubmitted.');
  }

  const before = { status: product.status };
  product.status = 'QC_PENDING';
  product.reviewReason = null;
  await product.save();
  await Offer.updateMany({ productId: product._id }, { $set: { status: 'QC_PENDING', productStatus: 'QC_PENDING', reviewReason: null } });

  await recordAudit({
    action: 'listing.resubmit',
    subjectType: 'product',
    subjectId: product._id,
    before,
    after: { status: 'QC_PENDING' },
    actor,
  });

  const variant = await Variant.findById(offer.variantId).lean();
  return serializeListing({ ...offer, status: 'QC_PENDING', productStatus: 'QC_PENDING', reviewReason: null }, product.toObject(), variant);
}

export async function listMyListings(sellerId, query) {
  const filter = { sellerId };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ productTitle: pattern }, { sku: pattern }, { sellerSku: pattern }, { brandName: pattern }];
  }
  if (query.status?.length) filter.status = { $in: query.status };
  if (query.fulfillmentType) filter.fulfillmentType = query.fulfillmentType;

  const sortField = ['createdAt', 'updatedAt', 'sellingPricePaise', 'stock', 'productTitle'].includes(query.sortField)
    ? query.sortField
    : 'updatedAt';
  const sort = { [sortField]: query.sortDirection, _id: 1 };
  const [rows, total, statuses] = await Promise.all([
    Offer.find(filter).sort(sort).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    Offer.countDocuments(filter),
    Offer.aggregate([{ $match: { sellerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return {
    data: rows.map(serializeListingRow),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { status: Object.fromEntries(statuses.map((item) => [item._id, item.count])) },
    },
  };
}
