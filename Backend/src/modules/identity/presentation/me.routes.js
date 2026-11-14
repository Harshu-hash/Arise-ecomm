import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { changePassword, publicUser } from '../application/auth.service.js';
import { listSessions, revokeSession } from '../application/session.service.js';
import { User } from '../infrastructure/persistence/user.model.js';

const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
const sessionParams = z.object({ id: objectIdSchema });

export function createMeRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.userId);
      if (!user) throw new NotFoundError();
      return sendData(res, publicUser(user));
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
