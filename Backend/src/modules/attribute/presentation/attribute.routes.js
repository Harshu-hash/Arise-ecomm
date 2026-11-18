import { Router } from 'express';
import { z } from 'zod';
import { getUserAuthorization } from '../../identity/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { ATTRIBUTE_TYPES } from '../domain/services/attributeRules.js';
import {
  createAttribute,
  createAttributeSet,
  deleteAttribute,
  deleteAttributeSet,
  listAttributes,
  listAttributeSets,
  updateAttribute,
  updateAttributeSet,
} from '../application/attribute.service.js';

const typeSchema = z.enum(ATTRIBUTE_TYPES);
const valueInput = z.union([
  z.string().trim().min(1).max(100),
  z.object({ value: z.string().trim().min(1).max(100) }).strict(),
]);
const attributeFields = {
  name: z.string().trim().min(1).max(100),
  type: typeSchema,
  unit: z.string().trim().max(32).nullable(),
  filterable: z.boolean(),
  variantDefining: z.boolean(),
  values: z.array(valueInput).max(200),
};
const createAttributeSchema = z.object({
  name: attributeFields.name,
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{0,63}$/, 'Use lowercase letters, numbers, and underscores.'),
  type: attributeFields.type,
  unit: attributeFields.unit.optional(),
  filterable: attributeFields.filterable.optional().default(false),
  variantDefining: attributeFields.variantDefining.optional().default(false),
  values: attributeFields.values.optional().default([]),
}).strict();
const updateAttributeSchema = z.object({
  ...Object.fromEntries(Object.entries(attributeFields).map(([key, schema]) => [key, schema.optional()])),
  version: z.number().int().min(1),
}).strict();
const setFields = {
  name: z.string().trim().min(1).max(100),
  rootName: z.string().trim().max(100).nullable(),
  attributeIds: z.array(objectIdSchema).min(1).max(200),
};
const createSetSchema = z.object({
  name: setFields.name,
  rootName: setFields.rootName.optional(),
  attributeIds: setFields.attributeIds,
}).strict();
const updateSetSchema = z.object({
  ...Object.fromEntries(Object.entries(setFields).map(([key, schema]) => [key, schema.optional()])),
  version: z.number().int().min(1),
}).strict();
const idParams = z.object({ id: objectIdSchema });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  q: z.string().trim().max(100).optional(),
  sort: z.string().optional().default('name'),
  type: z.string().optional(),
  filterable: z.enum(['true', 'false']).optional(),
  variantDefining: z.enum(['true', 'false']).optional(),
}).strict().transform((query) => ({
  ...query,
  type: query.type ? query.type.split(',').filter((value) => ATTRIBUTE_TYPES.includes(value)) : [],
  filterable: query.filterable === undefined ? undefined : query.filterable === 'true',
  variantDefining: query.variantDefining === undefined ? undefined : query.variantDefining === 'true',
  sortField: query.sort.replace(/^-/, ''),
  sortDirection: query.sort.startsWith('-') ? -1 : 1,
}));

const hasPermission = (permissions, key) => permissions.includes('*') || permissions.includes(key);
const requirePermission = (action) => (req, _res, next) =>
  next(hasPermission(req.attributeAuthorization.permissions, `catalog.attribute.${action}`) ? undefined : new ForbiddenError());

function authorizationRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.use(async (req, _res, next) => {
    try {
      const authorization = await getUserAuthorization(req.auth.userId);
      if (!authorization) throw new NotFoundError('Admin account not found.');
      req.attributeAuthorization = authorization;
      next();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createAttributeRouter() {
  const router = authorizationRouter();
  router.get('/', requirePermission('view'), validate({ query: listQuery }), async (req, res, next) => {
    try {
      const result = await listAttributes(req.query);
      return sendData(res, result.data, { meta: result.meta });
    } catch (error) {
      return next(error);
    }
  });
  router.post('/', requirePermission('create'), validate({ body: createAttributeSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await createAttribute(req.body, req.auth), { status: 201 });
    } catch (error) {
      return next(error);
    }
  });
  router.patch('/:id', requirePermission('edit'), validate({ params: idParams, body: updateAttributeSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await updateAttribute(req.params.id, req.body, req.auth));
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/:id', requirePermission('delete'), validate({ params: idParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await deleteAttribute(req.params.id, req.auth));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

export function createAttributeSetRouter() {
  const router = authorizationRouter();
  router.get('/', requirePermission('view'), async (_req, res, next) => {
    try {
      return sendData(res, await listAttributeSets());
    } catch (error) {
      return next(error);
    }
  });
  router.post('/', requirePermission('create'), validate({ body: createSetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await createAttributeSet(req.body, req.auth), { status: 201 });
    } catch (error) {
      return next(error);
    }
  });
  router.patch('/:id', requirePermission('edit'), validate({ params: idParams, body: updateSetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await updateAttributeSet(req.params.id, req.body, req.auth));
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/:id', requirePermission('delete'), validate({ params: idParams }), async (req, res, next) => {
    try {
      return sendCommand(res, await deleteAttributeSet(req.params.id, req.auth));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
