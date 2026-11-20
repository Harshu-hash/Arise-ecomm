import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema, pageQuery, parseSort } from '../../../shared/validators/common.js';
import { createBanner, deleteBanner, listBanners, updateBanner } from '../application/banner.service.js';
import { BANNER_KINDS, BANNER_PLACEMENTS, BANNER_STATUS } from '../domain/constants/banner.js';

const SORTABLE = ['priority', 'startsAt', 'impressions'];

// Images must be files this platform stored via the CMS_MEDIA upload purpose, not arbitrary external URLs.
const cmsImage = z.url().max(500).refine((url) => url.startsWith(`${env.PUBLIC_ORIGIN}/uploads/cms/`), 'Upload the image first.');
const fields = {
  name: z.string().trim().min(1, 'Give the banner a name.').max(100),
  kind: z.enum(BANNER_KINDS),
  images: z.object({ mobile_16_9: cmsImage, tile_1_1: cmsImage, web: cmsImage }).strict(),
  altText: z.string().trim().min(1, 'Required for accessibility.').max(200),
  placements: z.array(z.enum(BANNER_PLACEMENTS)).min(1, 'Choose a placement.').max(BANNER_PLACEMENTS.length),
  categoryIds: z.array(objectIdSchema).max(50),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};
const createSchema = z.object({ ...fields, categoryIds: fields.categoryIds.default([]) }).strict();
const updateSchema = z.object(Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()]))).strict();
const idParams = z.object({ id: objectIdSchema });
const csv = (allowed) => z.string().optional().transform((value) => (value ? value.split(',').filter((item) => allowed.includes(item)) : []));
const listQuery = pageQuery
  .extend({ kind: csv(BANNER_KINDS), status: csv(Object.values(BANNER_STATUS)) })
  .transform((query) => ({ ...query, ...parseSort(query.sort, SORTABLE, 'priority') }));

// Mount path: /api/admin/v1/banners. Status is derived from the schedule, never set by hand.
export function createBannerRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('cms.banner.view'), validate({ query: listQuery }), async (req, res) => {
    const { data, meta } = await listBanners(req.query);
    return sendData(res, data, { meta });
  });
  router.post('/', requirePermission('cms.banner.create'), validate({ body: createSchema }), async (req, res) =>
    sendCommand(res, await createBanner(req.body, req.auth), { status: 201 }),
  );
  router.patch('/:id', requirePermission('cms.banner.edit'), validate({ params: idParams, body: updateSchema }), async (req, res) =>
    sendCommand(res, await updateBanner(req.params.id, req.body, req.auth)),
  );
  router.delete('/:id', requirePermission('cms.banner.delete'), validate({ params: idParams }), async (req, res) =>
    sendCommand(res, await deleteBanner(req.params.id, req.auth)),
  );

  return router;
}
