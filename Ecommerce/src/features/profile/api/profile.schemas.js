import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const profileDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(80),
  emailMasked: z.string().nullable(),
  phoneMasked: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  avatarUrl: z.string().url().nullable(),
  pendingVerification: z
    .object({
      challengeId: z.string().min(1),
      field: z.enum(['EMAIL', 'PHONE']),
      destinationMasked: z.string().min(1),
      expiresAt: z.string().datetime(),
    })
    .nullable(),
  updatedAt: z.string().datetime(),
});
export const profileResponseSchema = apiEnvelope(profileDtoSchema);
