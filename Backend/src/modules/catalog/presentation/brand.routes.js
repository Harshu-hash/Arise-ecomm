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
import { createBrand, deleteBrand, listBrands, updateBrand } from '../application/brand.service.js';
import { BRAND_OWNER_TYPES, BRAND_STATUSES } from '../domain/services/brandRules.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  imageUrl: z.url().max(2048).nullable().optional(),
  rootCategory: z.string().trim().min(1).max(100).nullable().optional(),
  ownerType: z.enum(BRAND_OWNER_TYPES).optional(),
  gated: z.boolean().optional().default(false),
}).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  imageUrl: z.url().max(2048).nullable().optional(),
  rootCategory: z.string().trim().max(100).nullable().optional(),
  gated: z.boolean().optional(),
  version: z.number().int().min(1),
}).strict();
const idParams = z.object({ id: objectIdSchema });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  q: z.string().trim().max(100).optional(),
  sort: z.string().optional().default('name'),
  status: z.union([z.enum(BRAND_STATUSES), z.literal('all')]).optional(),
  gated: z.enum(['true', 'false']).optional(),
  rootCategory: z.string().trim().max(100).optional(),
  ownerType: z.enum(BRAND_OWNER_TYPES).optional(),
}).strict().transform((query) => ({
  ...query,
  status: query.status === 'all' ? undefined : query.status,
  gated: query.gated === undefined ? undefined : query.gated === 'true',
  sortField: query.sort.replace(/^-/, ''),
  sortDirection: query.sort.startsWith('-') ? -1 : 1,
}));

const hasPermission = (permissions, key) => permissions.includes('*') || permissions.includes(key);
const requirePermission = (action) => markPermissionGuard((req, _res, next) =>
  next(hasPermission(req.brandAuthorization.permissions, `catalog.brand.${action}`) ? undefined : new ForbiddenError()));

export function createBrandRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.use(async (req, _res, next) => {
    try {
      const authorization = await getUserAuthorization(req.auth.userId);
      if (!authorization) throw new NotFoundError('Admin account not found.');
      req.brandAuthorization = authorization;
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get('/', requirePermission('view'), validate({ query: listQuery }), async (req, res, next) => {
    try {
      const result = await listBrands(req.query, req.brandAuthorization.scope);
      return sendData(res, result.data, { meta: result.meta });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', requirePermission('create'), validate({ body: createSchema }), idempotent(), async (req, res, next) => {
    try {
      const data = await createBrand(req.body, { scope: req.brandAuthorization.scope, actor: req.auth });
      return sendCommand(res, data, { status: 201 });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id', requirePermission('edit'), validate({ params: idParams, body: updateSchema }), async (req, res, next) => {
    try {
      const data = await updateBrand(req.params.id, req.body, {
        scope: req.brandAuthorization.scope,
        actor: req.auth,
      });
      return sendCommand(res, data);
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', requirePermission('delete'), validate({ params: idParams }), async (req, res, next) => {
    try {
      const data = await deleteBrand(req.params.id, {
        scope: req.brandAuthorization.scope,
        actor: req.auth,
      });
      return sendCommand(res, data);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
