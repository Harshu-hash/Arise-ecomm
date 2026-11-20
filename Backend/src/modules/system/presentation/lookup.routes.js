import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { userHasPermission } from '../../../shared/middleware/permission.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { findCustomers } from '../../identity/public/index.js';
import { findLiveProducts } from '../../product/public/index.js';

// Each entity is readable by whoever may view it OR by the marketing screens that need to pick it.
const ENTITIES = {
  product: {
    permissions: ['catalog.product.view', 'marketing.deal.view', 'marketing.coupon.view'],
    find: async (query) => (await findLiveProducts(query)).map((p) => ({ value: p.id, label: p.title, sublabel: p.categoryPath })),
  },
  customer: {
    permissions: ['customers.customer.view', 'marketing.coupon.view'],
    find: async (query) => (await findCustomers(query)).map((c) => ({ value: c.id, label: c.name, sublabel: c.contact })),
  },
};

const params = z.object({ entity: z.enum(Object.keys(ENTITIES)) });
const query = z.object({
  q: z.string().trim().max(100).optional(),
  ids: z.string().optional().transform((value) => (value ? value.split(',').slice(0, 50) : undefined)),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine((value) => !value.ids || value.ids.every((id) => objectIdSchema.safeParse(id).success), { message: 'Invalid ids', path: ['ids'] });

// Mount path: /api/admin/v1/lookups — searchable options for the console's EntitySelect.
export function createLookupRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/:entity', validate({ params, query }), async (req, res) => {
    const entity = ENTITIES[req.params.entity];
    const allowed = await Promise.all(entity.permissions.map((key) => userHasPermission(req.auth.userId, key)));
    if (!allowed.some(Boolean)) throw new ForbiddenError();
    return sendData(res, await entity.find(req.query));
  });
  return router;
}
