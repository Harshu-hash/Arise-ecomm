import { Router } from 'express';
import { z } from 'zod';
import { getUserAuthorization } from '../../identity/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategoryTree,
  updateCategory,
} from '../application/category.service.js';

const returnType = z.enum(['REFUND', 'REPLACEMENT']);
const nullableObjectId = objectIdSchema.nullable();
const editableFields = {
  name: z.string().trim().min(1).max(100),
  status: z.enum(['ACTIVE', 'HIDDEN']),
  returnWindowDays: z.number().int().min(0).max(60),
  returnTypes: z.array(returnType).max(2),
  gated: z.boolean(),
  codAllowed: z.boolean(),
  gstRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]),
  hsnCode: z.string().trim().min(1).max(20).nullable(),
  attributeSetId: nullableObjectId,
  imageUrl: z.url().max(2048).nullable(),
  icon: z.string().trim().min(1).max(64).nullable(),
  color: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
};
const createSchema = z.object({
  name: editableFields.name,
  parentId: nullableObjectId.optional(),
  returnWindowDays: editableFields.returnWindowDays.optional(),
  returnTypes: editableFields.returnTypes.optional(),
  gated: editableFields.gated.optional(),
  codAllowed: editableFields.codAllowed.optional(),
  gstRate: editableFields.gstRate.optional(),
  hsnCode: editableFields.hsnCode.optional(),
  attributeSetId: editableFields.attributeSetId.optional(),
  imageUrl: editableFields.imageUrl.optional(),
  icon: editableFields.icon.optional(),
  color: editableFields.color.optional(),
}).strict();
const updateSchema = z.object({
  ...Object.fromEntries(Object.entries(editableFields).map(([key, schema]) => [key, schema.optional()])),
  version: z.number().int().min(1),
  hideListings: z.boolean().optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
}).strict();
const idParams = z.object({ id: objectIdSchema });

const hasPermission = (permissions, key) => permissions.includes('*') || permissions.includes(key);
const requireCategoryPermission = (action) => (req, _res, next) =>
  next(hasPermission(req.categoryAuthorization.permissions, `catalog.category.${action}`) ? undefined : new ForbiddenError());

export function createCategoryRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.use(async (req, _res, next) => {
    try {
      const authorization = await getUserAuthorization(req.auth.userId);
      if (!authorization) throw new NotFoundError('Admin account not found.');
      req.categoryAuthorization = {
        permissions: authorization.permissions ?? [],
        scope: authorization.scope ?? null,
      };
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get('/tree', requireCategoryPermission('view'), async (req, res, next) => {
    try {
      return sendData(res, await listCategoryTree(req.categoryAuthorization.scope));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', requireCategoryPermission('view'), validate({ params: idParams }), async (req, res, next) => {
    try {
      const result = await getCategory(req.params.id, req.categoryAuthorization.scope);
      const permissions = req.categoryAuthorization.permissions;
      const allowedActions = [
        ...(hasPermission(permissions, 'catalog.category.edit') ? ['EDIT'] : []),
        ...(result.meta.canDelete && hasPermission(permissions, 'catalog.category.delete') ? ['DELETE'] : []),
      ];
      return sendData(res, result.data, { meta: { ...result.meta, allowedActions } });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', requireCategoryPermission('create'), validate({ body: createSchema }), async (req, res, next) => {
    try {
      const data = await createCategory(req.body, {
        scope: req.categoryAuthorization.scope,
        actor: req.auth,
      });
      return sendCommand(res, data, { status: 201 });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id', requireCategoryPermission('edit'), validate({ params: idParams, body: updateSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await updateCategory(req.params.id, req.body, {
        scope: req.categoryAuthorization.scope,
        actor: req.auth,
      }));
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', requireCategoryPermission('delete'), validate({ params: idParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await deleteCategory(req.params.id, {
        scope: req.categoryAuthorization.scope,
        actor: req.auth,
      }));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
