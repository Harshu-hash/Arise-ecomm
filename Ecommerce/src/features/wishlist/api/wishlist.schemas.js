import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { productCardDtoSchema } from '@features/product/api/product.schemas';

export const wishlistItemDtoSchema = productCardDtoSchema.extend({
  addedAt: z.string().datetime(),
  available: z.boolean(),
});

export const wishlistResponseSchema = apiEnvelope(
  z.object({ items: z.array(wishlistItemDtoSchema), total: z.number().int().nonnegative() }),
);

export const wishlistMutationResponseSchema = apiEnvelope(
  z.object({ productId: z.string().min(1), wishlisted: z.boolean() }),
);

export const wishlistMoveResponseSchema = apiEnvelope(
  z.object({
    productId: z.string().min(1),
    wishlisted: z.literal(false),
    cartItemId: z.string().min(1),
  }),
);
