import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { getCustomer, listCustomers, setCustomerBlocked } from '../application/adminCustomer.service.js';
import { getUserAuthorization } from '../application/userAuthorization.service.js';

const STATUSES = ['ACTIVE', 'BLOCKED', 'DELETED'];
const SORT_FIELD = { name: 'name', joinedAt: 'createdAt', lastLoginAt: 'lastLoginAt' };
const idParams = z.object({ id: objectIdSchema });
const actionBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();
const listQuery = pageQuery
  .extend({
    status: z.string().optional(),
    'joinedAt[gte]': z.iso.datetime().optional(),
    'joinedAt[lte]': z.iso.datetime().optional(),
  })
  .transform((query) => {
    const { sortField, sortDirection } = parseSort(query.sort || '-joinedAt', Object.keys(SORT_FIELD), 'joinedAt');
    return {
      ...query,
      status: query.status ? query.status.split(',').filter((s) => STATUSES.includes(s)) : [],
      sortField: SORT_FIELD[sortField],
      sortDirection,
    };
  });

// Mount path: /api/admin/v1/customers.
export function createAdminCustomersRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('customers.customer.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listCustomers(req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id', requirePermission('customers.customer.view'), validate({ params: idParams }), async (req, res) => {
    const actor = await getUserAuthorization(req.auth.userId);
    const { data, meta } = await getCustomer(req.params.id, actor?.permissions ?? []);
    return sendData(res, data, { meta });
  });
  for (const [verb, blocked] of [['block', true], ['unblock', false]]) {
    router.post(`/:id/${verb}`, requirePermission('customers.customer.block'), validate({ params: idParams, body: actionBody }), async (req, res) =>
      sendCommand(res, await setCustomerBlocked(req.params.id, blocked, req.body.reason ?? null, req.auth)),
    );
  }
  return router;
}
