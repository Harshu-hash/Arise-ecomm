import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const deletionEligibilitySchema = z.object({
  eligible: z.boolean(),
  blockers: z.array(
    z.object({
      code: z.enum([
        'ACTIVE_ORDERS',
        'OPEN_RETURNS',
        'PENDING_REFUNDS',
        'WALLET_BALANCE',
        'LEGAL_RETENTION',
      ]),
      message: z.string().min(1),
      resolvesAt: z.string().datetime().nullable(),
    }),
  ),
  existingRequest: z
    .object({
      id: z.string(),
      status: z.enum(['REQUESTED', 'SCHEDULED', 'CANCELLED', 'COMPLETED']),
      requestedAt: z.string().datetime(),
      scheduledDeletionAt: z.string().datetime().nullable(),
    })
    .nullable(),
});
export const deletionEligibilityResponseSchema = apiEnvelope(deletionEligibilitySchema);
