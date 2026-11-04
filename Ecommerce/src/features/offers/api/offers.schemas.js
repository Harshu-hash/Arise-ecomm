import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

const promotionItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  imageUrl: z.string().url(),
  label: z.string().min(1),
  bannerText: z.string().min(1),
});

export const promotionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  tag: z.string().min(1),
  accent: z.string().min(1),
  variant: z.enum(['gradient', 'solid']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  couponCode: z.string().nullable(),
  couponHint: z.string().nullable(),
  items: z.array(promotionItemSchema),
});

const promotionProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  pricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  rating: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
});

export const promotionsResponseSchema = apiEnvelope(
  z.object({ brandTabs: z.array(z.record(z.unknown())), items: z.array(promotionSchema) }),
);
export const promotionResponseSchema = apiEnvelope(
  promotionSchema.extend({ relatedProducts: z.array(promotionProductSchema) }),
);
export const promotionProductsResponseSchema = apiEnvelope(
  z.object({ items: z.array(promotionProductSchema), nextCursor: z.string().nullable() }),
);
