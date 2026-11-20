import { Router } from 'express';
import { z } from 'zod';
import { getUserAuthorization } from '../../identity/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import {
  changeCampaignStatus,
  createCampaign,
  decideSubmissions,
  getCampaign,
  listCampaigns,
  listSubmissions,
  setHomeFlashSale,
  updateCampaign,
} from '../application/campaign.service.js';
import { CAMPAIGN_STATUS, CAMPAIGN_TYPES, CUSTOMER_SECTIONS, SUBMISSION_DECISIONS, SUBMISSION_STATUS } from '../domain/constants/campaign.js';

const CAMPAIGN_SORTABLE = ['createdAt', 'startsAt', 'endsAt', 'name'];
const SUBMISSION_SORTABLE = ['submittedAt', 'dealPricePaise', 'discountPct'];

const fields = {
  name: z.string().trim().min(1, 'Give the campaign a name.').max(80),
  type: z.enum(CAMPAIGN_TYPES),
  customerSection: z.enum(CUSTOMER_SECTIONS),
  tagline: z.string().trim().max(60),
  minDiscountPct: z.number().int().min(1).max(95),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  submissionDeadline: z.coerce.date().nullable(),
};
const createSchema = z.object({ ...fields, tagline: fields.tagline.default(''), submissionDeadline: fields.submissionDeadline.default(null) }).strict();
const updateSchema = z.object(Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()]))).strict();
const statusSchema = z.object({ status: z.enum(Object.values(CAMPAIGN_STATUS)) }).strict();
const decisionSchema = z.object({
  submissionIds: z.array(objectIdSchema).min(1).max(200),
  decision: z.enum(Object.keys(SUBMISSION_DECISIONS)),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();
const idParams = z.object({ id: objectIdSchema });
const flashSaleSchema = z.object({ enabled: z.boolean() }).strict();
// `status=all` is what the UI sends for its "All" tab.
const csv = (allowed) => z.string().optional().transform((value) => (value ? value.split(',').filter((item) => allowed.includes(item)) : []));
const campaignQuery = pageQuery
  .extend({ type: csv(CAMPAIGN_TYPES), status: csv(Object.values(CAMPAIGN_STATUS)) })
  .transform((query) => ({ ...query, ...parseSort(query.sort || '-createdAt', CAMPAIGN_SORTABLE, 'createdAt') }));
const submissionQuery = pageQuery
  .extend({ status: csv(Object.values(SUBMISSION_STATUS)) })
  .transform((query) => ({ ...query, ...parseSort(query.sort || '-submittedAt', SUBMISSION_SORTABLE, 'submittedAt') }));

// Cancelling is its own permission; every other move is an edit.
const statusPermission = (req, res, next) =>
  requirePermission(req.body.status === CAMPAIGN_STATUS.CANCELLED ? 'marketing.campaign.cancel' : 'marketing.campaign.edit')(req, res, next);

// Mount path: /api/admin/v1/campaigns (promotional campaigns sellers nominate products into).
export function createCampaignRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('marketing.campaign.view'), validate({ query: campaignQuery }), async (req, res) => {
    const { data, meta } = await listCampaigns(req.query);
    return sendData(res, data, { meta });
  });
  router.post('/', requirePermission('marketing.campaign.create'), validate({ body: createSchema }), async (req, res) =>
    sendCommand(res, await createCampaign(req.body, req.auth), { status: 201 }),
  );
  router.get('/:id', requirePermission('marketing.campaign.view'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await getCampaign(req.params.id)),
  );
  router.patch('/:id', requirePermission('marketing.campaign.edit'), validate({ params: idParams, body: updateSchema }), async (req, res) =>
    sendCommand(res, await updateCampaign(req.params.id, req.body, req.auth)),
  );
  router.post('/:id/status', validate({ params: idParams, body: statusSchema }), statusPermission, async (req, res) =>
    sendCommand(res, await changeCampaignStatus(req.params.id, req.body.status, req.auth)),
  );
  router.post('/:id/home-flash-sale', requirePermission('marketing.campaign.edit'), validate({ params: idParams, body: flashSaleSchema }), async (req, res) =>
    sendCommand(res, await setHomeFlashSale(req.params.id, req.body.enabled, req.auth)),
  );
  router.get('/:id/submissions', requirePermission('marketing.campaign.view'), validate({ params: idParams, query: submissionQuery }), async (req, res) => {
    const { data, meta } = await listSubmissions(req.params.id, req.query);
    return sendData(res, data, { meta });
  });
  router.post('/:id/submissions/decision', requirePermission('marketing.campaign.edit'), validate({ params: idParams, body: decisionSchema }), async (req, res) => {
    const actor = await getUserAuthorization(req.auth.userId);
    return sendCommand(res, await decideSubmissions(req.params.id, req.body, { ...req.auth, name: actor?.name }));
  });

  return router;
}
