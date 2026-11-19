import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { SCOPE_DIMENSIONS, SCOPE_LIMITS } from '../../../shared/rbac/scopes.js';
import {
  booleanQuery,
  emailSchema,
  objectIdSchema,
  pageQuery,
  paiseSchema,
  parseSort,
} from '../../../shared/validators/common.js';
import {
  deactivateAdminUser,
  getAdminUser,
  inviteAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  resendAdminInvite,
  revokeAdminSessions,
  updateAdminUser,
} from '../application/adminUser.service.js';
import { getUserAuthorization } from '../application/userAuthorization.service.js';

const SORTABLE = ['name', 'email', 'status', 'lastLoginAt', 'createdAt'];

// Scope narrows a role assignment: id lists per dimension, paise limits per threshold; null = unrestricted.
const scopeSchema = z
  .object({
    ...Object.fromEntries(SCOPE_DIMENSIONS.map((item) => [item.key, z.array(z.string().max(64)).max(500).nullable().optional()])),
    ...Object.fromEntries(SCOPE_LIMITS.map((item) => [item.key, paiseSchema.nullable().optional()])),
  })
  .strict()
  .nullable();

const fields = {
  name: z.string().trim().min(1, 'Enter their name.').max(100),
  roleIds: z.array(objectIdSchema).min(1, 'Assign at least one role.').max(20),
};
const inviteSchema = z.object({ name: fields.name, email: emailSchema, roleIds: fields.roleIds, scope: scopeSchema.optional() }).strict();
const updateSchema = z.object({
  name: fields.name.optional(),
  roleIds: fields.roleIds.optional(),
  scope: scopeSchema.optional(),
  defaultLanding: z.string().trim().startsWith('/').max(200).optional(),
  version: z.number().int().min(0).optional(),
}).strict();
const deactivateSchema = z.object({ reason: z.string().trim().min(1, 'Give a reason.').max(500) });
const revokeSchema = z.object({ sessionId: objectIdSchema.optional() });
const idParams = z.object({ id: objectIdSchema });
const listQuery = pageQuery
  .extend({
    status: z.string().optional(),
    roleId: objectIdSchema.optional(),
    twoFactorEnrolled: booleanQuery.optional(),
    'createdAt[gte]': z.iso.datetime().optional(),
    'createdAt[lte]': z.iso.datetime().optional(),
    'lastLoginAt[gte]': z.iso.datetime().optional(),
    'lastLoginAt[lte]': z.iso.datetime().optional(),
  })
  .transform((query) => ({
    ...query,
    status: query.status ? query.status.split(',') : [],
    ...parseSort(query.sort, SORTABLE, 'name'),
  }));

// Mount path: /api/admin/v1/admin-users. Passwords, 2FA secrets and invite tokens never leave the service.
export function createAdminUsersRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('admin.user.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listAdminUsers(req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id', requirePermission('admin.user.view'), validate({ params: idParams }), async (req, res) => {
    const actor = await getUserAuthorization(req.auth.userId);
    const { data, meta } = await getAdminUser(req.params.id, actor.permissions ?? []);
    return sendData(res, data, { meta });
  });
  router.post('/', requirePermission('admin.user.invite'), validate({ body: inviteSchema }), async (req, res) => {
    const { data, devHint } = await inviteAdminUser(req.body, req.auth);
    return sendData(res, data, { status: 201, meta: devHint && { devHint } });
  });
  router.patch('/:id', requirePermission('admin.user.edit'), validate({ params: idParams, body: updateSchema }), async (req, res) =>
    sendCommand(res, await updateAdminUser(req.params.id, req.body, req.auth)),
  );
  router.post('/:id/deactivate', requirePermission('admin.user.deactivate'), validate({ params: idParams, body: deactivateSchema }), async (req, res) => {
    const { data, sessionsRevoked } = await deactivateAdminUser(req.params.id, req.body, req.auth);
    return sendData(res, data, { meta: { sessionsRevoked } });
  });
  router.post('/:id/reactivate', requirePermission('admin.user.edit'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await reactivateAdminUser(req.params.id, req.auth)),
  );
  router.post('/:id/resend-invite', requirePermission('admin.user.invite'), validate({ params: idParams }), async (req, res) => {
    const { data, devHint } = await resendAdminInvite(req.params.id, req.auth);
    return sendData(res, data, { meta: devHint && { devHint } });
  });
  router.post('/:id/revoke-sessions', requirePermission('admin.user.revoke_session'), validate({ params: idParams, body: revokeSchema }), async (req, res) =>
    sendCommand(res, await revokeAdminSessions(req.params.id, req.body, req.auth)),
  );

  return router;
}
