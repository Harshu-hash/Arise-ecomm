import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const categorySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export const categoryTreeResponseSchema = apiEnvelope(z.array(categorySummarySchema));

const categoryTileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  imageUrl: z.string().url(),
  badge: z.string().nullable().optional(),
  badgeVariant: z.enum(['buyNow', 'notifyMe', 'recent', 'applyNow', 'title']).nullable().optional(),
  target: z
    .object({ type: z.string().min(1), id: z.string().optional() })
    .nullable()
    .optional(),
});

export const categoryDetailResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    heroBanner: z.object({ title: z.string().min(1), imageUrl: z.string().url() }).nullable(),
    sections: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        viewAll: z.boolean().default(false),
        items: z.array(categoryTileSchema),
      }),
    ),
  }),
);
