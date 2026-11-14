import { Router } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../../../shared/http/refreshCookie.js';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { verifyRefreshToken } from '../../../shared/utils/jwt.js';
import { enrolTwoFactor, login, publicUser, verifyTwoFactor } from '../application/auth.service.js';
import { revokeSession, rotateSession } from '../application/session.service.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { deviceOf, sendAuthResult } from './authResult.js';

const loginSchema = z
  .object({
    email: z.string().trim().min(1).optional(),
    emailOrPhone: z.string().trim().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((body) => body.email || body.emailOrPhone, { message: 'An email or phone is required.', path: ['email'] });

const verifySchema = z.object({ challengeId: objectIdSchema, code: z.string().min(4).max(10) });

// Mounted once per audience (customer/seller/admin): `allowedRoles` keeps one audience's
// login endpoint from authenticating another audience's account.
export function createAuthRouter({ allowedRoles, cookiePath }) {
  const router = Router();

  router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
    try {
      const { email, emailOrPhone, password } = req.body;
      const result = await login({ allowedRoles, identifier: emailOrPhone ?? email, password, device: deviceOf(req) });
      return sendAuthResult(res, cookiePath, result);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/2fa/verify', validate({ body: verifySchema }), async (req, res, next) => {
    try {
      const result = await verifyTwoFactor({ ...req.body, device: deviceOf(req) });
      return sendAuthResult(res, cookiePath, result);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/2fa/enrol', validate({ body: verifySchema }), async (req, res, next) => {
    try {
      const result = await enrolTwoFactor({ ...req.body, device: deviceOf(req) });
      return sendAuthResult(res, cookiePath, result);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const refreshToken = readRefreshCookie(req);
      if (!refreshToken) throw new UnauthorizedError('Session is no longer valid.');
      // The frontend's session bootstrap treats a refresh response without `user` as "no
      // session" and logs the user out, so this must carry the current profile too.
      const { sub: userId } = verifyRefreshToken(refreshToken);
      const tokens = await rotateSession(refreshToken);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt, cookiePath);
      const user = await User.findById(userId);
      return sendCommand(res, { accessToken: tokens.accessToken, user: user ? publicUser(user) : null });
    } catch (error) {
      clearRefreshCookie(res, cookiePath);
      return next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const refreshToken = readRefreshCookie(req);
      if (refreshToken) {
        try {
          const claims = verifyRefreshToken(refreshToken);
          await revokeSession(claims.sid, claims.sub);
        } catch {
          // Already invalid/expired: nothing to revoke, logout still succeeds.
        }
      }
      clearRefreshCookie(res, cookiePath);
      return sendCommand(res, { loggedOut: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
