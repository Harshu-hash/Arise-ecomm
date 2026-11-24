import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { csvQuery, objectIdSchema } from '../../../shared/validators/common.js';
import { audienceCounts, cancelBroadcast, createBroadcast, listBroadcasts } from '../application/broadcast.service.js';

const PLATFORMS = ['ANDROID', 'IOS'];
const blankToNull = (schema) => z.preprocess((value) => (value === '' ? null : value), schema.nullish().transform((value) => value ?? null));

const createBody = z.object({
  title: z.string().trim().min(1).max(65),
  message: z.string().trim().min(1).max(240),
  campaignName: z.string().trim().min(1).max(120),
  imageUrl: blankToNull(z.string().trim().url().max(500).startsWith('https://')),
  deepLink: blankToNull(z.string().trim().max(200).regex(/^(arise|https):\/\/\S+$/, 'Use a link like arise://offers/diwali.')),
  audiences: z.array(z.enum(['CUSTOMERS', 'SELLERS'])).min(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  priority: z.enum(['NORMAL', 'HIGH']).default('NORMAL'),
  sound: z.boolean().default(true),
  collapseKey: blankToNull(z.string().trim().max(64).regex(/^[\w-]+$/, 'Use letters, numbers, - and _.')),
  scheduleAt: blankToNull(z.coerce.date()),
  expiresAt: blankToNull(z.coerce.date()),
}).superRefine((body, ctx) => {
  const start = body.scheduleAt ?? new Date();
  if (body.expiresAt && body.expiresAt <= start) ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'The expiry must be after the send time.' });
});
const audienceQuery = z.object({ platforms: csvQuery(PLATFORMS).transform((list) => (list?.length ? list : PLATFORMS)) });
const idParams = z.object({ id: objectIdSchema });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mount path: /api/admin/v1/push-broadcasts
export function createAdminBroadcastRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('notifications.broadcast.view'), route(async (_req, res) => sendData(res, await listBroadcasts())));
  router.get('/audience', validate({ query: audienceQuery }), requirePermission('notifications.broadcast.view'), route(async (req, res) => sendData(res, await audienceCounts(req.query.platforms))));
  router.post('/', validate({ body: createBody }), requirePermission('notifications.broadcast.send'), route(async (req, res) => sendData(res, await createBroadcast(req.body, req.auth), { status: 201 })));
  router.post('/:id/cancel', validate({ params: idParams }), requirePermission('notifications.broadcast.send'), route(async (req, res) => sendData(res, await cancelBroadcast(req.params.id, req.auth))));

  return router;
}
