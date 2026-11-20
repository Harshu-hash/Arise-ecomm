import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../../shared/middleware/permission.js';
import { csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { audienceReach } from '../application/coupon.service.js';
import { createDeal, deleteDeal, listCalendar, listDeals, rescheduleDeal } from '../application/deal.service.js';
import { DEAL_PLACEMENTS, DEAL_STATUS, DEAL_TAGS } from '../domain/constants/coupon.js';
import { isCalendarDay } from '../domain/services/dealRules.js';
import { audienceSchema } from './coupon.routes.js';

const SORTABLE = ['startsAt', 'endsAt', 'dealPricePaise', 'slotDate'];
const slotDate = z.string().refine(isCalendarDay, 'Pick a valid date.');

const createSchema = z.object({
  title: z.string().trim().min(1, 'Give the deal a title.').max(80),
  label: z.string().trim().max(40).default(''),
  tag: z.enum(DEAL_TAGS).default('TRENDING'),
  productId: objectIdSchema,
  dealPricePaise: z.number().int().min(100).max(1_000_000_000),
  placement: z.enum(DEAL_PLACEMENTS).default('OFFERS_PAGE'),
  slotDate: slotDate.nullable().default(null),
  startsAt: z.coerce.date().default(() => new Date()),
  endsAt: z.coerce.date(),
}).strict();
const idParams = z.object({ id: objectIdSchema });
const rescheduleBody = z.object({ slotDate }).strict();
const listQuery = pageQuery
  .extend({ placement: z.enum(DEAL_PLACEMENTS).optional(), tag: csvQuery(DEAL_TAGS), status: csvQuery(Object.values(DEAL_STATUS)) })
  .transform((query) => ({ ...query, ...parseSort(query.sort || '-startsAt', SORTABLE, 'startsAt') }));

// Mount path: /api/admin/v1/deals. Status is derived from the schedule, never set by hand.
export function createDealRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('marketing.deal.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listDeals(req.query);
    return sendData(res, data, { meta });
  });
  // Before '/:id' routes so "calendar" is never read as an id.
  router.get('/calendar', requirePermission('marketing.deal.view'), async (_req, res) => sendCommand(res, await listCalendar()));
  router.post('/', requirePermission('marketing.deal.create'), validate({ body: createSchema }), async (req, res) =>
    sendCommand(res, await createDeal(req.body, req.auth), { status: 201 }),
  );
  router.post('/:id/reschedule', requirePermission('marketing.deal.edit'), validate({ params: idParams, body: rescheduleBody }), async (req, res) =>
    sendCommand(res, await rescheduleDeal(req.params.id, req.body.slotDate, req.auth)),
  );
  router.delete('/:id', requirePermission('marketing.deal.delete'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await deleteDeal(req.params.id, req.auth)),
  );

  return router;
}

// Mount path: /api/admin/v1/campaigns/reach (mounted before the promo-campaign router) — the console's audience picker
// asks it how many customers an audience reaches while a coupon or campaign is being set up.
export function createAudienceReachRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.post('/', requireAnyPermission('marketing.coupon.view', 'marketing.campaign.view'), validate({ body: z.object({ audience: audienceSchema }) }), async (req, res) =>
    sendCommand(res, await audienceReach(req.body.audience)),
  );
  return router;
}
