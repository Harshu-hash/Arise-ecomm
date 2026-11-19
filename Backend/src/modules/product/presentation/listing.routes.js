import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, paiseSchema } from '../../../shared/validators/common.js';
import { createListing, getListingForSeller, listMyListings, resubmitListing } from '../application/listing.service.js';

// Every image/video/document field is a media ID from the media workflow
// (POST /media/uploads -> ... -> complete), resolved to its storage key server-side —
// never a raw key or URL from the client.
const dimsSchema = z.object({
  l: z.number().positive(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const variantInputSchema = z.object({
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  label: z.string().trim().max(200).optional(),
  sku: z.string().trim().max(64).optional(),
  sellerSku: z.string().trim().max(64).optional(),
  barcode: z.string().trim().max(32).optional(),
  ean: z.string().trim().max(32).optional(),
  taxCode: z.string().trim().max(20).optional(),
  mrpPaise: paiseSchema.optional(),
  sellingPricePaise: paiseSchema.optional(),
  stock: z.number().int().min(0).optional(),
  weightG: z.number().int().positive().optional(),
  dimsCm: dimsSchema.optional(),
  images: z.array(objectIdSchema).max(8).optional(),
}).strict();

// Mirrors the seller "Add product" form exactly: either `variants[]` (a category with
// variant-defining attributes) or the simple-product fields at the top level, never both.
const createListingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  categoryId: objectIdSchema,
  brandId: objectIdSchema.nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  highlights: z.array(z.string().trim().max(200)).max(20).optional(),
  images: z.array(objectIdSchema).max(8).optional(),
  videos: z.array(objectIdSchema).max(2).optional(),
  complianceDocuments: z.array(objectIdSchema).max(5).optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  fit: z.string().trim().max(100).nullable().optional(),
  care: z.string().trim().max(500).nullable().optional(),
  modelInfo: z.string().trim().max(200).nullable().optional(),
  manufacturer: z.string().trim().max(200).optional(),
  countryOfOrigin: z.string().trim().max(100).optional(),
  productCode: z.string().trim().max(64).nullable().optional(),
  sizeChartId: objectIdSchema.nullable().optional(),
  returnPolicy: z.object({
    windowDays: z.number().int().min(0).max(60).optional(),
    type: z.enum(['RETURN', 'REPLACEMENT', 'NONE']).optional(),
  }).optional(),
  fulfillmentType: z.enum(['SELLER', 'ARISE']).optional(),
  status: z.enum(['DRAFT']).optional(),
  variants: z.array(variantInputSchema).min(1).max(200).optional(),
  mrpPaise: paiseSchema.optional(),
  sellingPricePaise: paiseSchema.optional(),
  stock: z.number().int().min(0).optional(),
  weightG: z.number().int().positive().optional(),
  dimsCm: dimsSchema.optional(),
  barcode: z.string().trim().max(32).optional(),
}).strict();

const idParams = z.object({ id: objectIdSchema });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
  q: z.string().trim().max(100).optional(),
  sort: z.string().optional().default('-updatedAt'),
  status: z.string().optional(),
  fulfillmentType: z.enum(['SELLER', 'ARISE']).optional(),
}).strict().transform((query) => ({
  ...query,
  status: query.status ? query.status.split(',').filter(Boolean) : undefined,
  sortField: query.sort.replace(/^-/, ''),
  sortDirection: query.sort.startsWith('-') ? -1 : 1,
}));

export function createListingRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.post('/', validate({ body: createListingSchema }), idempotent(), async (req, res, next) => {
    try {
      const sellerId = sellerScope(req);
      const data = await createListing(req.body, { sellerId, actor: req.auth });
      return sendCommand(res, data, { status: 201 });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', validate({ query: listQuery }), async (req, res, next) => {
    try {
      const sellerId = sellerScope(req);
      const result = await listMyListings(sellerId, req.query);
      return sendData(res, result.data, { meta: result.meta });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', validate({ params: idParams }), async (req, res, next) => {
    try {
      const sellerId = sellerScope(req);
      return sendData(res, await getListingForSeller(req.params.id, sellerId));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/resubmit', validate({ params: idParams }), async (req, res, next) => {
    try {
      const sellerId = sellerScope(req);
      return sendCommand(res, await resubmitListing(req.params.id, { sellerId, actor: req.auth }));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
