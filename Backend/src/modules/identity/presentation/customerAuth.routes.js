import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../../../shared/http/refreshCookie.js';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { verifyRefreshToken } from '../../../shared/utils/jwt.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { publicUser } from '../application/auth.service.js';
import {
  resendCustomerOtp,
  resetCustomerPassword,
  startCustomerAuth,
  verifyCustomerOtp,
  verifyCustomerPasswordReset,
} from '../application/customerAuth.service.js';
import { revokeAllSessions, revokeSession, rotateSession } from '../application/session.service.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { deviceOf } from './authResult.js';

const startSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3)
      .max(254)
      .refine(
        (value) => z.email().safeParse(value).success || /^(?:\+?91|0)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, '')),
        'Enter a valid email or Indian mobile number.',
      ),
    purpose: z.enum(['LOGIN', 'SIGNUP', 'PASSWORD_RESET']),
    name: z.string().trim().min(1).max(80).optional(),
    referralCode: z.string().trim().max(20).optional(),
  })
  .refine((body) => body.purpose !== 'SIGNUP' || body.name, { message: 'Name is required.', path: ['name'] });
const otpSchema = z.object({ challengeId: objectIdSchema, otp: z.string().regex(/^\d{4}$/) });
const resendSchema = z.object({ challengeId: objectIdSchema });
const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });
const resetSchema = z.object({ resetToken: z.string().min(1), password: z.string().min(8) });

function sendSession(res, cookiePath, result) {
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt, cookiePath);
  return sendCommand(res, {
    user: publicUser(result.user),
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
  });
}

async function customerForRefresh(refreshToken) {
  const { sub } = verifyRefreshToken(refreshToken);
  const user = await User.findById(sub);
  if (!user || user.role !== ROLES.CUSTOMER || user.status !== 'ACTIVE') throw new UnauthorizedError('Session is no longer valid.');
  return user;
}

export function createCustomerAuthRouter({ cookiePath }) {
  const router = Router();

  router.post('/start', validate({ body: startSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await startCustomerAuth(req.body));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/resend-otp', validate({ body: resendSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await resendCustomerOtp(req.body));
    } catch (error) {
      return next(error);
    }
  });

  const verify = (requiredStage) => async (req, res, next) => {
    try {
      const result = await verifyCustomerOtp({ ...req.body, requiredStage, device: deviceOf(req) });
      return sendSession(res, cookiePath, result);
    } catch (error) {
      return next(error);
    }
  };
  router.post('/verify-otp', validate({ body: otpSchema }), verify());
  router.post('/signup', validate({ body: otpSchema }), verify('signup'));

  router.post('/password/verify-otp', validate({ body: otpSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await verifyCustomerPasswordReset(req.body));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/password/reset', validate({ body: resetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await resetCustomerPassword(req.body));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/refresh', validate({ body: refreshSchema }), async (req, res, next) => {
    try {
      const refreshToken = req.body.refreshToken ?? readRefreshCookie(req);
      if (!refreshToken) throw new UnauthorizedError('Session is no longer valid.');
      const user = await customerForRefresh(refreshToken);
      const tokens = await rotateSession(refreshToken);
      return sendSession(res, cookiePath, { user, tokens });
    } catch (error) {
      clearRefreshCookie(res, cookiePath);
      return next(error);
    }
  });

  router.get('/session', authenticate, authorize(ROLES.CUSTOMER), async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.userId);
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('Session is no longer valid.');
      return sendCommand(res, {
        user: publicUser(user),
        accessToken: req.get('authorization').slice('Bearer '.length),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', validate({ body: refreshSchema }), async (req, res, next) => {
    try {
      const refreshToken = req.body.refreshToken ?? readRefreshCookie(req);
      if (refreshToken) {
        try {
          const claims = verifyRefreshToken(refreshToken);
          await revokeSession(claims.sid, claims.sub);
        } catch {
          // Logout remains successful when the submitted session has already expired.
        }
      }
      clearRefreshCookie(res, cookiePath);
      return sendCommand(res, { loggedOut: true });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout-all', authenticate, authorize(ROLES.CUSTOMER), async (req, res, next) => {
    try {
      await revokeAllSessions(req.auth.userId);
      clearRefreshCookie(res, cookiePath);
      return sendCommand(res, { loggedOut: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
