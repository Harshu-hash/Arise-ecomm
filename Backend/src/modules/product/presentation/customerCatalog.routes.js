import { Router } from 'express';
import { z } from 'zod';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { authenticate, authorize, optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { recordSearch } from '../../search/public/index.js';
import { deleteCustomerProductHistory, SORT_OPTIONS, getCustomerProduct, listCustomerBrands, listRecentlyViewed, listRelatedProducts, recordProductView, searchCustomerProducts } from '../application/customerCatalog.service.js';

const csv = z.string().optional().transform((value) => (value ? value.split(',').filter(Boolean) : []));
const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: objectIdSchema.optional(),
  brandId: objectIdSchema.optional(),
  sellerId: objectIdSchema.optional(), // a seller's shop: only products they have a live offer on
  categories: csv,
  brands: csv,
  priceRangeId: z.string().max(10).optional(),
  minRating: z.coerce.number().min(0).max(5).default(0),
  sort: z.enum(SORT_OPTIONS.map((option) => option.id)).default('relevance'),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

// Mounted at /api/customer/v1/search — public catalog read.
export function createCustomerSearchRouter() {
  const router = Router();
  router.get('/', validate({ query: searchQuery }), async (req, res, next) => {
    try {
      const result = await searchCustomerProducts(req.query);
      // The first page of a typed search counts toward trending; paging and filtering do not.
      if (req.query.q && req.query.cursor === 0) recordSearch(req.query.q, result.total, req.ip);
      return sendData(res, result);
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

const brandsQuery = z.object({
  filter: z.string().trim().max(60).default('All'),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

// Mounted at /api/customer/v1/brands — public: the Brands page.
export function createCustomerBrandRouter() {
  const router = Router();
  router.get('/', validate({ query: brandsQuery }), async (req, res, next) => {
    try {
      return sendData(res, await listCustomerBrands(req.query));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

// Mounted at /api/customer/v1/me/recently-viewed — the signed-in customer's own history.
export function createCustomerRecentlyViewedRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.CUSTOMER));
  router.get('/', async (req, res, next) => {
    try {
      return sendData(res, await listRecentlyViewed(req.auth.userId));
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/', async (req, res, next) => {
    try {
      await deleteCustomerProductHistory(req.auth.userId);
      return sendCommand(res, { cleared: true });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

// Mounted at /api/customer/v1/products.
export function createCustomerProductRouter() {
  const router = Router();
  // "Similar Products" and "Products you may like" under a product page.
  router.get('/:id/related', optionalAuthenticate, validate({ params: z.object({ id: objectIdSchema }) }), async (req, res, next) => {
    try {
      return sendData(res, await listRelatedProducts(req.params.id, { userId: req.auth?.role === 'CUSTOMER' ? req.auth.userId : null }));
    } catch (error) {
      return next(error);
    }
  });
  router.get('/:id', optionalAuthenticate, validate({ params: z.object({ id: objectIdSchema }) }), async (req, res, next) => {
    try {
      const product = await getCustomerProduct(req.params.id);
      if (req.auth?.role === 'CUSTOMER') recordProductView(req.auth.userId, req.params.id).catch(() => undefined);
      return sendData(res, product);
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
