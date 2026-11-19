import { Router } from 'express';
import { z } from 'zod';
import { AuditLog } from '../../../infrastructure/audit/audit.model.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { getUserSummaries } from '../../identity/public/index.js';

const params = z.object({ type: z.string().trim().min(1).max(60), id: z.string().trim().min(1).max(100) });

/** Field-level before/after — `null` before means every field in `after` was newly set. */
function diffFields(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes = [];
  for (const field of keys) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from, to });
  }
  return changes;
}

// Mount path: /api/admin/v1/audit-events. One generic "History" feed every admin detail
// page's <AuditDrawer> reads from, keyed by the same subjectType/subjectId every module's
// recordAudit() call already writes.
export function createAuditRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN), requirePermission('admin.audit.view'));

  router.get('/entity/:type/:id', validate({ params }), async (req, res, next) => {
    try {
      const entries = await AuditLog.find({ subjectType: req.params.type, subjectId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const actorById = await getUserSummaries(entries.map((e) => e.actorId));
      const rows = entries.map((e) => {
        const actor = e.actorId ? actorById.get(String(e.actorId)) : null;
        return {
          id: String(e._id),
          action: e.action,
          at: e.createdAt,
          actorId: e.actorId,
          actorName: actor?.name ?? (e.actorId ? null : 'System'),
          actorEmail: actor?.email ?? null,
          reason: e.reason,
          changes: diffFields(e.before, e.after),
        };
      });

      return sendData(res, rows);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
