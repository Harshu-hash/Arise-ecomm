import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import {
  decideRollback,
  getDraft,
  getPublished,
  listBrandTabs,
  listCategoryTabs,
  listVersions,
  publishHome,
  reorderCategoryTabs,
  requestRollback,
  updateBrandTab,
  updateCategoryTab,
  updateDraft,
} from '../application/homeLayout.service.js';
import { getPage, listPages, publishPage } from '../application/staticPage.service.js';
import { HOME_SECTION_TYPES, MAX_HOME_SECTIONS, MAX_PAGE_BODY } from '../domain/constants/cms.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #FFE11B.');
const section = z.object({
  type: z.enum(HOME_SECTION_TYPES),
  campaignId: objectIdSchema.optional(),
  // Free-form JSON, but always an object: a bare string/array/null would break the app's section renderer.
  config: z.record(z.string(), z.unknown()).default({}),
  visibility: z.object({ enabled: z.boolean() }).default({ enabled: true }),
});
const draftBody = z.object({ sections: z.array(section).max(MAX_HOME_SECTIONS) }).strict();
const publishBody = z.object({ note: z.string().trim().max(200).optional() }).strict();
const rollbackBody = z.object({ versionId: objectIdSchema, reason: z.string().trim().min(1, 'Say why the layout is being rolled back.').max(500) }).strict();
const idParams = z.object({ id: objectIdSchema });
const categoryTabBody = z
  .object({
    label: z.string().trim().min(1, 'A tab needs a label.').max(30),
    icon: z.string().trim().min(1).max(40),
    gradient: z.tuple([hexColor, hexColor]),
    layoutVariant: z.string().trim().min(1).max(30),
    active: z.boolean(),
  })
  .partial();
const brandTabBody = z
  .object({
    label: z.string().trim().min(1, 'A tab needs a label.').max(30),
    logo: z.url().max(500).nullable(),
    target: z.string().trim().min(1).max(100).nullable(),
    active: z.boolean(),
  })
  .partial();
const reorderBody = z.object({ orderedIds: z.array(objectIdSchema).min(1).max(100) }).strict();
const pageBody = z
  .object({
    body: z.string().trim().min(1, 'The page cannot be empty.').max(MAX_PAGE_BODY, 'The page is too long.'),
    materialChange: z.boolean().default(false),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

// Mount path: /api/admin/v1/cms — the home layout builder and its header tabs.
export function createCmsRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/home/draft', requirePermission('cms.home.view'), async (req, res) => sendCommand(res, await getDraft(req.auth)));
  router.patch('/home/draft', requirePermission('cms.home.edit'), validate({ body: draftBody }), async (req, res) =>
    sendCommand(res, await updateDraft(req.body.sections, req.auth)),
  );
  router.get('/home/published', requirePermission('cms.home.view'), async (_req, res) => sendCommand(res, await getPublished()));
  router.get('/home/versions', requirePermission('cms.home.view'), async (_req, res) => sendCommand(res, await listVersions()));
  router.post('/home/publish', requirePermission('cms.home.publish'), validate({ body: publishBody }), async (req, res) =>
    sendCommand(res, await publishHome(req.body, req.auth), { status: 201 }),
  );
  // 202: the rollback is only a request until a different admin approves it.
  router.post('/home/rollback', requirePermission('cms.home.rollback'), validate({ body: rollbackBody }), async (req, res) =>
    sendCommand(res, await requestRollback(req.body, req.auth), { status: 202 }),
  );
  router.post('/home/versions/:id/rollback/approve', requirePermission('cms.home.rollback'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await decideRollback(req.params.id, true, req.auth)),
  );
  router.post('/home/versions/:id/rollback/reject', requirePermission('cms.home.rollback'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await decideRollback(req.params.id, false, req.auth)),
  );

  router.get('/category-tabs', requirePermission('cms.home.view'), async (_req, res) => sendCommand(res, await listCategoryTabs()));
  // Before '/:id' so "reorder" is never read as an id.
  router.patch('/category-tabs/reorder', requirePermission('cms.home.edit'), validate({ body: reorderBody }), async (req, res) =>
    sendCommand(res, await reorderCategoryTabs(req.body.orderedIds, req.auth)),
  );
  router.patch('/category-tabs/:id', requirePermission('cms.home.edit'), validate({ params: idParams, body: categoryTabBody }), async (req, res) =>
    sendCommand(res, await updateCategoryTab(req.params.id, req.body, req.auth)),
  );
  router.get('/brand-tabs', requirePermission('cms.home.view'), async (_req, res) => sendCommand(res, await listBrandTabs()));
  router.patch('/brand-tabs/:id', requirePermission('cms.home.edit'), validate({ params: idParams, body: brandTabBody }), async (req, res) =>
    sendCommand(res, await updateBrandTab(req.params.id, req.body, req.auth)),
  );

  return router;
}

// Mount path: /api/admin/v1/static-pages — About, Privacy, Terms and the other policy pages.
export function createStaticPageRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('cms.page.view'), async (_req, res) => sendCommand(res, await listPages()));
  router.get('/:id', requirePermission('cms.page.view'), validate({ params: idParams }), async (req, res) => sendCommand(res, await getPage(req.params.id)));
  // Saving publishes immediately, so it needs the publish permission.
  router.patch('/:id', requirePermission('cms.page.publish'), validate({ params: idParams, body: pageBody }), async (req, res) =>
    sendCommand(res, await publishPage(req.params.id, req.body, req.auth)),
  );
  return router;
}
