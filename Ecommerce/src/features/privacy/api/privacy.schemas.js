import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const communicationPreferencesSchema = z.object({
  orderUpdatesPush: z.boolean(),
  orderUpdatesEmail: z.boolean(),
  orderUpdatesSms: z.boolean(),
  offersPush: z.boolean(),
  offersEmail: z.boolean(),
  offersSms: z.boolean(),
  recommendationsPush: z.boolean(),
  updatedAt: z.string().datetime(),
});
export const communicationPreferencesResponseSchema = apiEnvelope(communicationPreferencesSchema);
export const exportRequestSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['REQUESTED', 'PREPARING', 'READY', 'EXPIRED', 'FAILED']),
  requestedAt: z.string().datetime(),
  readyBy: z.string().datetime(),
  downloadUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime().nullable(),
});
export const exportRequestResponseSchema = apiEnvelope(exportRequestSchema.nullable());
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
