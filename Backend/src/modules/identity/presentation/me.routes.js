import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { changePassword, publicUser } from '../application/auth.service.js';
import { listSessions, revokeSession } from '../application/session.service.js';
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

const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
const sessionParams = z.object({ id: objectIdSchema });

export function createMeRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.userId);
      if (!user) throw new NotFoundError();
      return sendData(res, user.role === ROLES.CUSTOMER ? customerProfile(user) : publicUser(user));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/sessions', async (req, res, next) => {
    try {
      return sendData(res, await listSessions(req.auth.userId));
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
