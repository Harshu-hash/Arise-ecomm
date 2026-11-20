import { Router } from 'express';
import { z } from 'zod';
import { listLiveBanners } from '../../admin/public/index.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { getCustomerCategory, listCustomerCategories } from '../application/category.service.js';

export function createCustomerCategoryRouter() {
  const router = Router();

  router.get('/tree', async (_req, res, next) => {
    try {
      return sendData(res, await listCustomerCategories());
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', validate({ params: z.object({ id: objectIdSchema }) }), async (req, res, next) => {
    try {
      const category = await getCustomerCategory(req.params.id);
      // An admin-scheduled category banner wins over the category's own image.
      const [banner] = await listLiveBanners('CATEGORY_HERO', { categoryId: req.params.id });
      if (banner) category.heroBanner = { title: banner.altText, imageUrl: banner.imageUrl };
      return sendData(res, category);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
