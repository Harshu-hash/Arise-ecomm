import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { changePassword, sessionUser } from '../application/auth.service.js';
import { GENDERS, getCustomerProfile, updateCustomerProfile, verifyContactChange } from '../application/customerProfile.service.js';
import { listSessions, revokeSession } from '../application/session.service.js';
import { Role } from '../infrastructure/persistence/role.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

// Customer profile edits: name/gender/photo, or a new email/phone that must be verified with a code first.
const profilePatch = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(80).optional(),
  gender: z.enum(GENDERS).optional(),
  avatarMediaId: z.string().min(1).max(300).optional(), // the id the profile-photo upload returned
  newEmail: z.email('Enter a valid email address.').max(254).transform((value) => value.toLowerCase()).optional(),
  newPhone: z.string().trim().min(10).max(20).optional(),
}).strict();
const verifyContactBody = z.object({ challengeId: objectIdSchema, otp: z.string().trim().regex(/^\d{4,6}$/, 'Enter the code you received.') }).strict();
const customersOnly = (req, _res, next) => next(req.auth.role === ROLES.CUSTOMER ? undefined : new ForbiddenError());

const passwordSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(8, 'Use at least 8 characters.').max(128) });
const preferencesSchema = z.object({ notifyInPanel: z.boolean().optional(), notifyEmail: z.boolean().optional() }).strict();
const sessionParams = z.object({ id: objectIdSchema });

// The admin's own view of their account: sessionUser plus role names, sign-in time and alert preferences.
async function adminProfile(user) {
  const roles = await Role.find({ _id: { $in: user.roleIds ?? [] } }, 'name').lean();
  return {
    ...(await sessionUser(user)),
    roleNames: roles.map((role) => role.name),
    lastLoginAt: user.lastLoginAt,
    notifyInPanel: user.notifyInPanel,
    notifyEmail: user.notifyEmail,
  };
}

const sessionRow = (session) => ({
  id: String(session._id),
  device: session.device?.label ?? session.device?.userAgent ?? 'Unknown device',
  ip: session.device?.ip ?? null,
  createdAt: session.createdAt,
  lastActiveAt: session.lastUsedAt,
});

export function createMeRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      if (req.auth.role === ROLES.CUSTOMER) return sendData(res, await getCustomerProfile(req.auth.userId));
      const user = await User.findById(req.auth.userId);
      if (!user) throw new NotFoundError();
      return sendData(res, user.role === ROLES.ADMIN ? await adminProfile(user) : await sessionUser(user));
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/', customersOnly, validate({ body: profilePatch }), async (req, res) =>
    sendCommand(res, await updateCustomerProfile(req.auth.userId, req.body)),
  );
  router.post('/contact/verify', customersOnly, validate({ body: verifyContactBody }), async (req, res) =>
    sendCommand(res, await verifyContactChange(req.auth.userId, req.body)),
  );

  router.get('/sessions', async (req, res, next) => {
    try {
      return sendData(res, (await listSessions(req.auth.userId)).map(sessionRow));
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/sessions/:id', validate({ params: sessionParams }), async (req, res, next) => {
    try {
      const revoked = await revokeSession(req.params.id, req.auth.userId);
      if (!revoked) throw new NotFoundError();
      return sendCommand(res, { revoked: true });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/preferences', authorize(ROLES.ADMIN), validate({ body: preferencesSchema }), async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(req.auth.userId, { $set: req.body }, { new: true });
      if (!user) throw new NotFoundError();
      return sendCommand(res, { notifyInPanel: user.notifyInPanel, notifyEmail: user.notifyEmail });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/password', validate({ body: passwordSchema }), async (req, res, next) => {
    try {
      await changePassword({ userId: req.auth.userId, ...req.body });
      return sendCommand(res, { changed: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
