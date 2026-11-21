import { Router } from 'express';
import { z } from 'zod';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { getFlashSale, getPromotion, listFlashSales, listPromotionProducts, listPromotions } from '../application/customerCampaign.service.js';

const idParams = z.object({ id: objectIdSchema });
const productsQuery = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Mounted at /api/customer/v1/flash-sales — public read of the live flash sales (there can be more than one at once).
export function createCustomerFlashSaleRouter() {
  const router = Router();
  router.get('/', async (_req, res) => sendData(res, await listFlashSales()));
  router.get('/:id', validate({ params: idParams }), async (req, res) => sendData(res, await getFlashSale(req.params.id)));
  return router;
}

// Mounted at /api/customer/v1/promotions — live admin campaigns with their approved products.
export function createCustomerPromotionRouter({ brandTabs = [] } = {}) {
  const router = Router();
  router.get('/', async (_req, res) => sendData(res, { brandTabs, items: await listPromotions() }));
  router.get('/:id', validate({ params: idParams }), async (req, res) => sendData(res, await getPromotion(req.params.id)));
  router.get('/:id/products', validate({ params: idParams, query: productsQuery }), async (req, res) =>
    sendData(res, await listPromotionProducts(req.params.id, req.query)),
  );
  return router;
}
