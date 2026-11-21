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
import { recordListingStockEdits } from './inventory.service.js';
import {
  buildVariantSpecs,
  generateSku,
  validatePricing,
  validateProductAttributeValues,
  validateVariantAttributeValues,
  validateVariantCombinations,
  variantDefiningCodes,
} from '../domain/services/productRules.js';
import { bestOffer } from './customerCatalog.service.js';
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
  // The seller's whole product: every variant they list, each with its own offer.
  const [offers, variants] = await Promise.all([
    Offer.find({ productId: product._id, sellerId }).sort({ createdAt: 1, _id: 1 }).lean(),
    Variant.find({ productId: product._id }).sort({ createdAt: 1, _id: 1 }).lean(),
  ]);
  const variantById = new Map(variants.map((v) => [String(v._id), v]));
  return {
    ...serializeListing(offer, product, variant),
    product: { ...product, imageUrls: (product.images ?? []).map((k) => urlForKey(k, 'PRODUCT_IMAGE')) },
    variant,
    variants: offers
      .filter((o) => variantById.has(String(o.variantId)))
      .map((o) => {
        const v = variantById.get(String(o.variantId));
        return {
          offerId: id(o._id),
          label: v.label,
          sku: v.sku,
          sellerSku: o.sellerSku,
          ean: v.ean,
          attributes: v.attributes ?? {},
          sellingPricePaise: o.sellingPricePaise,
          mrpPaise: o.mrpPaise,
          stock: o.stock,
          status: o.status,
          weightG: v.weightG,
          dimsCm: v.dimsCm,
          images: v.images ?? [],
          imageUrls: (v.images ?? []).map((k) => urlForKey(k, 'PRODUCT_IMAGE')),
        };
      }),
  };
}

/** Keeps entries that are already stored keys; resolves the rest as new media IDs, preserving order. */
async function resolveImages(list, existingKeys, sellerId, field) {
  const fresh = list.filter((item) => !existingKeys.includes(item));
  const resolved = await resolveOrThrow(fresh, ['PRODUCT_IMAGE'], field, sellerId);
  return list.map((item) => (existingKeys.includes(item) ? item : resolved.shift()));
}

/** Seller edits the whole product they created: content, category attributes, and each variant's offer. */
export async function updateListing(offerId, body, { sellerId, actor }) {
  const offer = await Offer.findOne({ _id: offerId, sellerId }).lean();
  if (!offer) throw new NotFoundError('That listing does not exist on your account.');
  const product = await Product.findById(offer.productId);
  if (!product) throw new NotFoundError('That listing does not exist on your account.');
  if (product.createdBySellerId !== sellerId) {
    throw new ConflictError('NOT_PRODUCT_OWNER', 'Only the seller who created this product can edit it.');
  }

  if (body.attributes) {
    const category = await getCategoryForListing(String(product.categoryId));
    const { attributes } = await attributeSetDetails(category?.attributeSetId, { activeOnly: true });
    const { errors, clean } = validateProductAttributeValues(body.attributes, attributes.filter((a) => !a.variantDefining));
    if (Object.keys(errors).length) throw new ValidationError('Invalid category attributes.', errors);
    product.attributes = clean;
    // The customer page reads these two from the top level, not the attribute bag.
    product.fit = clean.fit ?? null;
    product.care = clean.wash_care ?? null;
  }
  if (body.brandId !== undefined) {
    const brand = body.brandId ? await findBrandForListing(body.brandId) : null;
    if (body.brandId && !brand) throw new ValidationError('Brand not found.', { brandId: ['Choose a valid brand.'] });
    product.brandId = brand?.id ?? null;
    product.brandName = brand?.name ?? null;
  }
  if (body.sizeChartId !== undefined) {
    const chart = body.sizeChartId ? await findSizeChartForListing(body.sizeChartId, String(product.categoryId)) : null;
    if (body.sizeChartId && !chart) {
      throw new ValidationError('Size chart not found.', { sizeChartId: ['Choose a size chart that belongs to this category.'] });
    }
    product.sizeChartId = chart;
  }
  if (body.images) product.images = await resolveImages(body.images, product.images, sellerId, 'images');
  for (const field of ['title', 'description', 'highlights', 'modelInfo', 'manufacturer', 'countryOfOrigin', 'productCode']) {
    if (body[field] !== undefined) product[field] = body[field] || (field === 'description' ? '' : null);
  }
  if (!product.title) throw new ValidationError('Title is required.', { title: ['Enter a title.'] });
  if (body.returnPolicy) Object.assign(product.returnPolicy, body.returnPolicy);

  const touched = [];
  const stockEdits = [];
  for (const item of body.variants ?? []) {
    const o = await Offer.findOne({ _id: item.offerId, sellerId, productId: product._id });
    const v = o && (await Variant.findById(o.variantId));
    if (!o || !v) throw new NotFoundError('One of the variants does not belong to this product.');
    const price = item.sellingPricePaise ?? o.sellingPricePaise;
    const mrp = item.mrpPaise ?? o.mrpPaise;
    if (price > mrp) throw new ValidationError('Invalid pricing.', { sellingPricePaise: ['Selling price cannot exceed MRP.'] });
    if (item.stock !== undefined && item.stock !== o.stock) {
      stockEdits.push({ offer: o, before: o.stock });
      o.version += 1; // an open stock-management edit of this row now gets VERSION_CONFLICT instead of overwriting it
    }
    for (const f of ['sellerSku', 'taxCode', 'stock']) if (item[f] !== undefined) o[f] = item[f];
    o.sellingPricePaise = price;
    o.mrpPaise = mrp;
    if (item.ean !== undefined) v.ean = item.ean || null;
    if (item.weightG !== undefined) v.weightG = item.weightG;
    if (item.dimsCm) v.dimsCm = item.dimsCm;
    if (item.images) v.images = await resolveImages(item.images, v.images, sellerId, 'images');
    touched.push(o, v);
  }

  await product.save();
  await Promise.all(touched.map((doc) => doc.save()));
  await recordListingStockEdits(stockEdits, actor);
  // Keep every offer's list-row snapshot in step with the product.
  await Offer.updateMany(
    { productId: product._id },
    { $set: { productTitle: product.title, productImage: urlForKey(product.images?.[0], 'PRODUCT_IMAGE'), brandName: product.brandName } },
  );
  await recordAudit({ action: 'listing.update', subjectType: 'product', subjectId: product._id, after: Object.keys(body), actor });
  return getListingForSeller(offerId, sellerId);
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

  // One row per product: its variants' offers are rolled up (price range, total stock).
  const sortField = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    sellingPricePaise: 'sellingPricePaise',
    stock: 'stock',
    productTitle: 'productTitle',
  }[query.sortField] ?? 'updatedAt';
  const sort = { [sortField]: query.sortDirection, _id: 1 };
  const [groups, [count], statuses] = await Promise.all([
    Offer.aggregate([
      { $match: filter },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: '$productId',
          offerId: { $first: '$_id' },
          variantCount: { $sum: 1 },
          sellingPricePaise: { $min: '$sellingPricePaise' },
          maxPricePaise: { $max: '$sellingPricePaise' },
          mrpPaise: { $min: '$mrpPaise' },
          stock: { $sum: '$stock' },
          buyBoxWinner: { $max: '$buyBoxWinner' },
          productTitle: { $first: '$productTitle' },
          createdAt: { $min: '$createdAt' },
          updatedAt: { $max: '$updatedAt' },
        },
      },
      { $sort: sort },
      { $skip: (query.page - 1) * query.pageSize },
      { $limit: query.pageSize },
    ]),
    Offer.aggregate([{ $match: filter }, { $group: { _id: '$productId' } }, { $count: 'total' }]),
    Offer.aggregate([
      { $match: { sellerId } },
      { $group: { _id: { status: '$status', productId: '$productId' } } },
      { $group: { _id: '$_id.status', count: { $sum: 1 } } },
    ]),
  ]);
  const total = count?.total ?? 0;
  const [offers, products] = await Promise.all([
    Offer.find({ sellerId, productId: { $in: groups.map((g) => g._id) } }).sort({ createdAt: 1, _id: 1 }).lean(),
    Product.find({ _id: { $in: groups.map((g) => g._id) } }).select('title images brandName').lean(),
  ]);
  const offerById = new Map(offers.map((o) => [String(o._id), o]));
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const rows = groups.map((g) => {
    const offer = offerById.get(String(g.offerId));
    const variants = offers
      .filter((o) => String(o.productId) === String(g._id))
      .map((o) => ({
        offerId: id(o._id),
        label: o.variantLabel,
        sku: o.sku,
        sellerSku: o.sellerSku,
        sellingPricePaise: o.sellingPricePaise,
        mrpPaise: o.mrpPaise,
        stock: o.stock,
        status: o.status,
      }));
    const product = productById.get(String(g._id));
    return {
      ...serializeListingRow(offer),
      productTitle: product?.title ?? offer.productTitle,
      productImage: offer.productImage ?? urlForKey(product?.images?.[0], 'PRODUCT_IMAGE'),
      brandName: offer.brandName ?? product?.brandName,
      variantLabel: g.variantCount > 1 ? `${g.variantCount} variants` : offer.variantLabel,
      variantCount: g.variantCount,
      variants,
      sellingPricePaise: g.sellingPricePaise,
      maxPricePaise: g.maxPricePaise,
      mrpPaise: g.mrpPaise,
      stock: g.stock,
      buyBoxWinner: g.buyBoxWinner,
    };
  });
  return {
    data: rows,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { status: Object.fromEntries(statuses.map((item) => [item._id, item.count])) },
    },
  };
}

/** The seller's own LIVE products, as picker options (e.g. a banner ad's destination). */
export async function listLiveProductOptions(sellerId) {
  const rows = await Product.find({ createdBySellerId: sellerId, status: 'LIVE' }, 'title').sort({ title: 1 }).lean();
  return rows.map((row) => ({ value: String(row._id), label: row.title }));
}

/**
 * The seller's admin-approved products that have a LIVE offer of theirs: what they can enter into a campaign.
 * Price and MRP are the shopper-facing (cheapest in-stock) offer's; stock is the total across their live offers.
 */
export async function listSellerCampaignProducts(sellerId, productIds = null) {
  const products = await Product.find(
    { createdBySellerId: sellerId, status: 'LIVE', 'images.0': { $exists: true }, ...(productIds ? { _id: { $in: productIds } } : {}) },
    'title brandName images',
  ).sort({ title: 1 }).lean();
  const offers = await Offer.find({ sellerId, productId: { $in: products.map((p) => p._id) }, status: 'LIVE' }).lean();
  return products.flatMap((product) => {
    const own = offers.filter((offer) => String(offer.productId) === String(product._id));
    if (!own.length) return [];
    const best = bestOffer(own);
    return [{
      id: String(product._id),
      title: product.title,
      brand: product.brandName ?? null,
      sku: best.sku ?? best.sellerSku ?? null,
      imageUrl: urlForKey(product.images[0], 'PRODUCT_IMAGE'),
      mrpPaise: Math.max(best.mrpPaise, best.sellingPricePaise),
      sellingPricePaise: best.sellingPricePaise,
      stock: own.reduce((sum, offer) => sum + offer.stock, 0),
    }];
  });
}
