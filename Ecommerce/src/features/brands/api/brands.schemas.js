import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const brandsResponseSchema = apiEnvelope(
  z.object({
    filters: z.array(z.string().min(1)),
    items: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        imageUrl: z.string().url(),
        offerText: z.string().nullable().optional(),
        category: z.string().min(1),
        popular: z.boolean().default(false),
      }),
    ),
    nextCursor: z.string().nullable(),
  }),
);
