import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, paiseSchema } from '../../../shared/validators/common.js';
import {
  getSellerCampaign,
  listEligibleProducts,
  listMyEntries,
  listSellerCampaigns,
  submitEntries,
  withdrawEntry,
} from '../application/sellerCampaign.service.js';
import { CAMPAIGN_TYPES } from '../domain/constants/campaign.js';

const idParams = z.object({ id: objectIdSchema });
const csv = (allowed) => z.string().optional().transform((value) => (value ? value.split(',').filter((item) => allowed.includes(item)) : []));
const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  type: csv(CAMPAIGN_TYPES),
  tab: z.enum(['all', 'open', 'joined']).default('all'),
});
const entriesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const submitSchema = z.object({
  entries: z.array(z.object({
    listingId: objectIdSchema, // the product being entered
    dealPricePaise: paiseSchema.refine((value) => value > 0, 'Enter a deal price.'),
    stockCommitted: z.number().int().min(1, 'Commit at least one unit.').max(1_000_000),
  }).strict()).min(1).max(50),
}).strict();

// Mount path: /api/seller/v1/campaigns — campaigns the admin runs, and this seller's entries into them.
export function createSellerCampaignRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listSellerCampaigns(sellerScope(req), req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id', validate({ params: idParams }), async (req, res) => sendData(res, await getSellerCampaign(sellerScope(req), req.params.id)));
  router.get('/:id/submissions', validate({ params: idParams, query: entriesQuery }), async (req, res) => {
    const { data, meta } = await listMyEntries(sellerScope(req), req.params.id, req.query);
    return sendData(res, data, { meta });
  });
  router.get('/:id/eligible-listings', validate({ params: idParams }), async (req, res) =>
    sendData(res, await listEligibleProducts(sellerScope(req), req.params.id)),
  );
  router.post('/:id/submissions', validate({ params: idParams, body: submitSchema }), async (req, res) =>
    sendCommand(res, await submitEntries(sellerScope(req), req.params.id, req.body.entries), { status: 201 }),
  );
  // Entries are addressed by their own id, not the campaign's.
  router.post('/submissions/:id/withdraw', validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await withdrawEntry(sellerScope(req), req.params.id)),
  );

  return router;
}
