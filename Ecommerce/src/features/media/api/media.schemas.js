import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const mediaUploadResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    url: z.string().url(),
    thumbnailUrl: z.string().url(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive(),
    status: z.literal('READY'),
  }),
);
