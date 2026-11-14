import { Router } from 'express';
import { z } from 'zod';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { acceptInvite, getInvite } from '../application/invite.service.js';
import { deviceOf, sendAuthResult } from './authResult.js';

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Include a letter and a number.'),
});

// Consumption side of the invite flow (admin/seller-staff accounts an authenticated management
// endpoint created with issueInvite). `cookiePath` is the audience's /auth prefix, same as login.
export function createInviteRouter({ cookiePath }) {
  const router = Router();

  router.get('/invite/:token', async (req, res, next) => {
    try {
      return sendData(res, await getInvite(req.params.token));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/invite/accept', validate({ body: acceptSchema }), async (req, res, next) => {
    try {
      const result = await acceptInvite({ ...req.body, device: deviceOf(req) });
      return sendAuthResult(res, cookiePath, result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
