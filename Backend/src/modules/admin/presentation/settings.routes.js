import { Router } from 'express';
import { z } from 'zod';
import { getUserAuthorization } from '../../identity/public/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { listSettings, updateSettingsSection } from '../application/settings.service.js';
import { SETTINGS_SECTION_IDS } from '../domain/constants/platformSettings.js';

const params = z.object({ sectionId: z.enum(SETTINGS_SECTION_IDS) });
const patchBody = z.object({
  values: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

// Mount path: /api/admin/v1/admin/settings. Section values are validated per section in the service.
export function createSettingsRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/', requirePermission('admin.settings.view'), async (_req, res) => sendData(res, await listSettings()));
  router.patch('/:sectionId', requirePermission('admin.settings.edit'), validate({ params, body: patchBody }), async (req, res) => {
    const actor = await getUserAuthorization(req.auth.userId);
    return sendCommand(res, await updateSettingsSection(req.params.sectionId, req.body, { ...req.auth, name: actor?.name }));
  });

  return router;
}
