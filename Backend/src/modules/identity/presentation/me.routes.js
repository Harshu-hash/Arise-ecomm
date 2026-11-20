import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { changePassword, sessionUser } from '../application/auth.service.js';
import { listSessions, revokeSession } from '../application/session.service.js';
import { Role } from '../infrastructure/persistence/role.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const maskEmail = (email) => (email ? email.replace(/^(.).*(@.*)$/, '$1***$2') : null);
const maskPhone = (phone) => (phone ? `${phone.slice(0, 3)}******${phone.slice(-4)}` : null);

/** The customer app's profile contract; gender/avatar aren't stored yet, so they take neutral defaults. */
export const customerProfile = (user) => ({
  id: String(user._id),
  name: user.name?.trim().length >= 2 ? user.name.trim() : 'Customer',
  emailMasked: maskEmail(user.email),
  phoneMasked: maskPhone(user.phone),
  emailVerified: Boolean(user.email),
  phoneVerified: Boolean(user.phone),
  gender: 'PREFER_NOT_TO_SAY',
  avatarUrl: null,
  pendingVerification: null,
  updatedAt: user.updatedAt.toISOString(),
});

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
      const user = await User.findById(req.auth.userId);
      if (!user) throw new NotFoundError();
      if (user.role === ROLES.CUSTOMER) return sendData(res, customerProfile(user));
      return sendData(res, user.role === ROLES.ADMIN ? await adminProfile(user) : await sessionUser(user));
    } catch (error) {
      return next(error);
    }
  });

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
