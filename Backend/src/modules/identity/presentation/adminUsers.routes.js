import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { emailSchema, objectIdSchema } from '../../../shared/validators/common.js';
import { issueInvite } from '../application/invite.service.js';
import { Role } from '../infrastructure/persistence/role.model.js';

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  roleIds: z.array(objectIdSchema).min(1, 'Assign at least one role.'),
  scope: z.record(z.string(), z.unknown()).nullable().optional(),
});

// Admin-only: lists the seeded roles for the "invite an admin" picker, and issues the
// invite itself. Both require admin.{role.view,user.invite} — only super_admin has
// `admin.user.invite` by default, matching ROLE_TEMPLATES (no other seeded role grants it).
export function createAdminUsersRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/roles', requirePermission('admin.role.view'), async (_req, res, next) => {
    try {
      const roles = await Role.find({}, 'key name description system scopedBy').lean();
      return sendData(res, roles.map(({ _id, ...role }) => ({ id: String(_id), ...role })));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/invite', requirePermission('admin.user.invite'), validate({ body: inviteSchema }), async (req, res, next) => {
    try {
      const roles = await Role.find({ _id: { $in: req.body.roleIds } }).lean();
      if (roles.length !== req.body.roleIds.length) throw new ValidationError('One or more roles do not exist.');

      const permissions = roles.some((role) => role.permissions.includes('*'))
        ? ['*']
        : Array.from(new Set(roles.flatMap((role) => role.permissions)));

      const result = await issueInvite({
        role: ROLES.ADMIN,
        email: req.body.email,
        name: req.body.name,
        permissions,
        scope: req.body.scope ?? null,
      });
      return sendCommand(res, result, { status: 201 });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
