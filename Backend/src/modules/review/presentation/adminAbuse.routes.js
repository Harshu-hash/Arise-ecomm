import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { csvQuery, objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { decideAbuseReport, listAbuseReports } from '../application/adminAbuse.service.js';

const listQuery = pageQuery.extend({ status: csvQuery(['OPEN', 'DISMISSED', 'REMOVED']), targetType: z.enum(['REVIEW']).optional() }).transform((query) => {
  const { sortField, sortDirection } = parseSort(query.sort || '-reportedAt', ['reportedAt', 'reporterCount'], 'reportedAt');
  return { ...query, sortField, sortDirection: query.sort ? sortDirection : -1 };
});
const idParams = z.object({ id: objectIdSchema });
const decideBody = z.object({ decision: z.enum(['DISMISSED', 'REMOVED']), reason: z.string().trim().max(1000).optional() });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mount path: /api/admin/v1/abuse-reports — seller complaints about reviews.
export function createAdminAbuseRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', validate({ query: listQuery }), requirePermission('reviews.abuse.view'), route(async (req, res) => {
    const { data, meta } = await listAbuseReports(req.query);
    return sendData(res, data, { meta });
  }));
  router.post('/:id/decide', validate({ params: idParams, body: decideBody }), requirePermission('reviews.abuse.decide'), route(async (req, res) =>
    sendCommand(res, await decideAbuseReport(req.params.id, req.body, req.auth))));

  return router;
}
