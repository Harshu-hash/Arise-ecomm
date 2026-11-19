import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { SCOPE_DIMENSIONS, SCOPE_LIMITS } from '../../../shared/rbac/scopes.js';
import { booleanQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { cloneRole, createRole, deleteRole, getRole, listRoles, updateRole } from '../application/role.service.js';

const SORTABLE = ['name', 'userCount', 'updatedAt', 'permissionCount'];

const roleFields = {
  name: z.string().trim().min(1, 'Give the role a name.').max(100),
  description: z.string().trim().max(200),
  scopedBy: z.array(z.enum([...SCOPE_DIMENSIONS, ...SCOPE_LIMITS].map((item) => item.key))).max(20),
  permissions: z.array(z.string().max(100)).min(1, 'Select at least one permission.').max(1000),
};
const createSchema = z.object({
  name: roleFields.name,
  description: roleFields.description.default(''),
  scopedBy: roleFields.scopedBy.default([]),
  permissions: roleFields.permissions,
}).strict();
const updateSchema = z.object({
  name: roleFields.name.optional(),
  description: roleFields.description.optional(),
  scopedBy: roleFields.scopedBy.optional(),
  permissions: roleFields.permissions.optional(),
  version: z.number().int().min(0),
}).strict();
const cloneSchema = z.object({ name: roleFields.name.optional(), description: roleFields.description.optional() }).strict();
const idParams = z.object({ id: objectIdSchema });
const listQuery = pageQuery
  .extend({ pageSize: z.coerce.number().int().min(1).max(200).default(50), system: booleanQuery.optional(), hasUsers: booleanQuery.optional() })
  .transform((query) => ({ ...query, ...parseSort(query.sort, SORTABLE, 'name') }));

// Mount path: /api/admin/v1/roles. Role changes apply immediately and are audited.
export function createRoleRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('admin.role.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listRoles(req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id', requirePermission('admin.role.view'), validate({ params: idParams }), async (req, res) => {
    const { data, meta } = await getRole(req.params.id);
    return sendData(res, data, { meta });
  });
  router.post('/', requirePermission('admin.role.create'), validate({ body: createSchema }), async (req, res) =>
    sendCommand(res, await createRole(req.body, req.auth), { status: 201 }),
  );
  router.post('/:id/clone', requirePermission('admin.role.create'), validate({ params: idParams, body: cloneSchema }), async (req, res) =>
    sendCommand(res, await cloneRole(req.params.id, req.body, req.auth), { status: 201 }),
  );
  router.patch('/:id', requirePermission('admin.role.edit'), validate({ params: idParams, body: updateSchema }), async (req, res) =>
    sendCommand(res, await updateRole(req.params.id, req.body, req.auth)),
  );
  router.delete('/:id', requirePermission('admin.role.delete'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await deleteRole(req.params.id, req.auth)),
  );

  return router;
}
