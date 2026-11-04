import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const recentlyViewedResponseSchema = apiEnvelope(
  z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        productId: z.string().min(1),
        imageUrl: z.string().url(),
        title: z.string().min(1),
        subtitle: z.string().min(1),
        viewedAt: z.string().datetime(),
      }),
    ),
  }),
);
