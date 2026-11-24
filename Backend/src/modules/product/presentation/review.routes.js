import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission, requirePermissionBy } from '../../../shared/middleware/permission.js';
import { scopedIds } from '../../../shared/middleware/scope.js';
import { categoryIdsUnderRoots } from '../../category/public/index.js';
import { Product } from '../infrastructure/persistence/product.model.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { decideProduct, deactivateOfferForAdmin, getProductForAdmin, listProductsForAdmin } from '../application/review.service.js';

// Not `.strict()`: the admin products page's FilterBar also offers categoryId/brandId/
// sellerId/stock/assured filters that nothing here implements yet — they're silently
// ignored (stripped) rather than turning every filtered request into a 422.
const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
  q: z.string().trim().max(100).optional(),
  sort: z.string().optional().default('-updatedAt'),
  status: z.string().optional(),
}).transform((query) => ({
  ...query,
  status: query.status ? query.status.split(',').filter(Boolean) : undefined,
  sortField: query.sort.replace(/^-/, ''),
  sortDirection: query.sort.startsWith('-') ? -1 : 1,
}));

const idParams = z.object({ id: objectIdSchema });
const decideParams = z.object({ id: objectIdSchema, action: z.enum(['approve', 'reject', 'request-changes']) });
const decideBody = z.object({ reason: z.string().trim().max(1000).optional(), note: z.string().trim().max(1000).optional() }).strict();

const DECISION_PERMISSION = {
  approve: 'catalog.product.approve',
  reject: 'catalog.product.reject',
  'request-changes': 'catalog.product.request_changes',
};

// The category ids an admin may touch: their scoped top-level categories and everything under them, or null for all.
const allowedCategoryIds = async (req) => {
  const roots = await scopedIds(req, 'categories');
  return roots ? categoryIdsUnderRoots(roots) : null;
};

// Mount path: /api/admin/v1/products. "See and approve" only — activate/deactivate/block/
// archive on an already-LIVE product are a separate, not-yet-built lifecycle feature.
export function createProductReviewRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  // An admin limited to some categories sees the rest as not found, in the queue and by id.
  router.param('id', async (req, _res, next, id) => {
    try {
      const allowed = await allowedCategoryIds(req);
      if (allowed) {
        const product = await Product.findById(id, 'categoryId').lean();
        if (product && !allowed.includes(String(product.categoryId))) throw new NotFoundError('That product does not exist.');
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', validate({ query: listQuery }), requirePermission('catalog.product.view'), async (req, res, next) => {
    try {
      const { data, meta } = await listProductsForAdmin(req.query, { categoryIds: await allowedCategoryIds(req) });
      return sendData(res, data, { meta });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', validate({ params: idParams }), requirePermission('catalog.product.view'), async (req, res, next) => {
    try {
      const { data, meta } = await getProductForAdmin(req.params.id);
      return sendData(res, data, { meta });
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    '/:id/:action',
    validate({ params: decideParams, body: decideBody }),
    requirePermissionBy((req) => DECISION_PERMISSION[req.params.action]),
    async (req, res, next) => {
      try {
        return sendCommand(res, await decideProduct(req.params.id, req.params.action, req.body, req.auth));
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}

// Mount path: /api/admin/v1/offers.
export function createOfferAdminRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.post(
    '/:id/deactivate',
    validate({ params: idParams, body: decideBody }),
    requirePermission('catalog.product.activate'),
    async (req, res, next) => {
      try {
        return sendCommand(res, await deactivateOfferForAdmin(req.params.id, req.body, req.auth));
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
