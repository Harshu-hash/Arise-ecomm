import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const flashSaleResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    items: z.array(
      z.object({
        id: z.string().min(1),
        productId: z.string().min(1),
        brand: z.string().min(1),
        name: z.string().min(1),
        imageUrl: z.string().url(),
        pricePaise: z.number().int().nonnegative(),
        mrpPaise: z.number().int().positive(),
        discountPct: z.number().int().min(0).max(100),
      }),
    ),
  }),
);
