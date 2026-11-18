import { Router } from 'express';
import { attributeSetDetails } from '../../attribute/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { Category } from '../infrastructure/persistence/category.model.js';
import { serializeCategory } from '../application/category.service.js';
import { z } from 'zod';

const idParams = z.object({ id: objectIdSchema });

export function createSellerCatalogRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/categories', async (_req, res, next) => {
    try {
      const rows = await Category.find({ status: 'ACTIVE' }).sort({ level: 1, sortOrder: 1 }).lean();
      const byId = new Map(rows.map((row) => [String(row._id), row]));
      const data = rows.filter((row) => row.level === 3).map((row) => {
        const names = [row.name];
        let parent = row.parentId ? byId.get(String(row.parentId)) : null;
        while (parent) {
          names.unshift(parent.name);
          parent = parent.parentId ? byId.get(String(parent.parentId)) : null;
        }
        return { ...serializeCategory(row, names[0]), path: names.join(' › ') };
      });
      return sendData(res, data);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/categories/:id/attributes', validate({ params: idParams }), async (req, res, next) => {
    try {
      const category = await Category.findOne({ _id: req.params.id, level: 3, status: 'ACTIVE' }).lean();
      if (!category) throw new NotFoundError('Category not found.');
      const { attributes } = await attributeSetDetails(category.attributeSetId, { activeOnly: true });
      return sendData(res, {
        category: { id: String(category._id), name: category.name, gated: category.gated },
        attributes,
        sizeCharts: [],
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
