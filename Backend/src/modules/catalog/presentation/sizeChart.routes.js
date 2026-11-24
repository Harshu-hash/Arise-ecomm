import { markPermissionGuard } from '../../../shared/middleware/permission.js';
import { Router } from 'express';
import { z } from 'zod';
import { getUserAuthorization } from '../../identity/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { createSizeChart, deleteSizeChart, listSizeCharts, updateSizeChart } from '../application/sizeChart.service.js';

const cell = z.string().trim().min(1).max(50);
const columns = z.array(cell).min(2).max(20);
const rows = z.array(z.array(cell).min(2).max(20)).min(1).max(200);
const fields = {
  name: z.string().trim().min(1).max(100),
  unit: z.enum(['in', 'cm']),
  categoryId: objectIdSchema.nullable(),
  columns,
  rows,
};
const createSchema = z.object({
  name: fields.name,
  unit: fields.unit,
  categoryId: fields.categoryId.optional(),
  columns: fields.columns,
  rows: fields.rows,
}).strict();
const updateSchema = z.object({
  ...Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])),
  version: z.number().int().min(1),
}).strict();
const idParams = z.object({ id: objectIdSchema });
const hasPermission = (permissions, key) => permissions.includes('*') || permissions.includes(key);
const requirePermission = (action) => markPermissionGuard((req, _res, next) =>
  next(hasPermission(req.sizeChartAuthorization.permissions, `catalog.sizechart.${action}`) ? undefined : new ForbiddenError()));

export function createSizeChartRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.use(async (req, _res, next) => {
    try {
      const authorization = await getUserAuthorization(req.auth.userId);
      if (!authorization) throw new NotFoundError('Admin account not found.');
      req.sizeChartAuthorization = authorization;
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get('/', requirePermission('view'), async (req, res, next) => {
    try {
      return sendData(res, await listSizeCharts(req.sizeChartAuthorization.scope));
    } catch (error) {
      return next(error);
    }
  });
  router.post('/', requirePermission('create'), validate({ body: createSchema }), idempotent(), async (req, res, next) => {
    try {
      return sendCommand(res, await createSizeChart(req.body, {
        scope: req.sizeChartAuthorization.scope, actor: req.auth,
      }), { status: 201 });
    } catch (error) {
      return next(error);
    }
  });
  router.patch('/:id', requirePermission('edit'), validate({ params: idParams, body: updateSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await updateSizeChart(req.params.id, req.body, {
        scope: req.sizeChartAuthorization.scope, actor: req.auth,
      }));
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/:id', requirePermission('delete'), validate({ params: idParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await deleteSizeChart(req.params.id, {
        scope: req.sizeChartAuthorization.scope, actor: req.auth,
      }));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
