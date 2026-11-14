import { Router } from 'express';
import { z } from 'zod';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { emailSchema } from '../../../shared/validators/common.js';
import { forgotPassword, resetPassword } from '../application/password.service.js';

const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Include a letter and a number.'),
});

// Mounted per audience on the same /auth prefix as login, so `allowedRoles` scopes which
// accounts a reset link can target and `resetUrlBase` points back at that audience's frontend.
export function createPasswordRouter({ allowedRoles, resetUrlBase }) {
  const router = Router();

  router.post('/forgot-password', validate({ body: forgotSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await forgotPassword({ allowedRoles, email: req.body.email, resetUrlBase }));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/reset-password', validate({ body: resetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await resetPassword(req.body));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
