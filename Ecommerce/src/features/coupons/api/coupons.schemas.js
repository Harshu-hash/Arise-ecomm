import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const couponsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        code: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        expiresAt: z.string().datetime(),
        eligibilityStatus: z.enum(['ELIGIBLE', 'INELIGIBLE', 'UNKNOWN']),
      }),
    ),
  }),
);
