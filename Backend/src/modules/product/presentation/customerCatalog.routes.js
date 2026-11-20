import { Router } from 'express';
import { z } from 'zod';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { SORT_OPTIONS, getCustomerProduct, recordProductView, searchCustomerProducts } from '../application/customerCatalog.service.js';

const csv = z.string().optional().transform((value) => (value ? value.split(',').filter(Boolean) : []));
const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: objectIdSchema.optional(),
  brandId: objectIdSchema.optional(),
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
      return sendData(res, await searchCustomerProducts(req.query));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

// Mounted at /api/customer/v1/products.
export function createCustomerProductRouter() {
  const router = Router();
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
