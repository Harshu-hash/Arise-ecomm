import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermissionBy } from '../../../shared/middleware/permission.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { findCustomers } from '../../identity/public/index.js';
import { scopedCustomerIds, scopedIds } from '../../../shared/middleware/scope.js';
import { findLiveProducts, getSellerProductIds } from '../../product/public/index.js';

// An admin limited to some sellers may only pick things that belong to them. `allowed` is the permitted ids (null = anything);
// asked-for ids are cut down to it, and with no ids asked for, the permitted ones are used instead of everything.
const narrow = (query, allowed) => {
  if (!allowed) return query;
  const ids = query.ids ? query.ids.filter((id) => allowed.includes(id)) : allowed;
  return { ...query, ids, empty: ids.length === 0 };
};

// Each entity is readable by whoever may view it OR by the marketing screens that need to pick it.
const ENTITIES = {
  product: {
    permissions: ['catalog.product.view', 'marketing.deal.view', 'marketing.coupon.view'],
    // shortcut: a product counts as theirs while a seller of theirs has a live offer on it
    find: async (query, req) => {
      const sellers = await scopedIds(req, 'sellers');
      const scoped = narrow(query, sellers && [...new Set((await Promise.all(sellers.map(getSellerProductIds))).flat())]);
      return scoped.empty ? [] : (await findLiveProducts(scoped)).map((p) => ({ value: p.id, label: p.title, sublabel: p.categoryPath }));
    },
  },
  customer: {
    permissions: ['customers.customer.view', 'marketing.coupon.view'],
    find: async (query, req) => {
      const scoped = narrow(query, await scopedCustomerIds(req));
      return scoped.empty ? [] : (await findCustomers(scoped)).map((c) => ({ value: c.id, label: c.name, sublabel: c.contact }));
    },
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
  router.get('/:entity', validate({ params, query }), requirePermissionBy((req) => ENTITIES[req.params.entity].permissions), async (req, res) => {
    return sendData(res, await ENTITIES[req.params.entity].find(req.query, req));
  });
  return router;
}
