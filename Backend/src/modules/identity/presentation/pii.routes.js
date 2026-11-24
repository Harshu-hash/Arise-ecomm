import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { sendCommand } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requireAnyPermission } from '../../../shared/middleware/permission.js';

const revealSchema = z.object({
  kind: z.string().min(1).max(40),
  entityType: z.string().min(1).max(40),
  entityId: z.string().min(1).max(64),
  entityLabel: z.string().max(200).optional(),
});

// MaskedValue already holds the value client-side before calling this — the data-access
// decision happened when the API first sent it (see sellerApplications.routes.js's
// sellers.bank.view_full check). This endpoint exists purely to leave an audit trail of
// who looked at what and when, which is the actual point of a "reveal" control.
export function createPiiRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  // Only an admin who may see personal data can log having revealed it; before this any signed-in user could write audit entries.
  router.post('/reveal', requireAnyPermission('customers.pii.view', 'sellers.bank.view_full', 'customers.customer.view'), validate({ body: revealSchema }), async (req, res, next) => {
    try {
      const { kind, entityType, entityId, entityLabel } = req.body;
      await recordAudit({
        action: 'pii.reveal',
        subjectType: entityType,
        subjectId: entityId,
        after: { kind, entityLabel },
        actor: { userId: req.auth.userId, role: req.auth.role },
      });
      return sendCommand(res, { revealed: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
