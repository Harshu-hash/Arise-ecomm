import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { productCardDtoSchema } from '@features/product/api/product.schemas';

const optionSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });

export const searchSuggestionsResponseSchema = apiEnvelope(
  z.object({
    suggestions: z.array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        category: z.string().nullable().optional(),
        type: z.enum(['arrow', 'chevron']),
        imageUrl: z.string().url(),
      }),
    ),
    trending: z.array(z.string().min(1)),
    prompts: z.array(z.string().min(1)),
  }),
);

export const searchProductsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(productCardDtoSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    facets: z.object({
      categories: z.array(z.string().min(1)),
      brands: z.array(z.string().min(1)),
      priceRanges: z.array(
        optionSchema.extend({
          minPaise: z.number().int().nonnegative(),
          maxPaise: z.number().int().positive().nullable(),
        }),
      ),
      ratings: z.array(optionSchema.extend({ value: z.number().min(0).max(5) })),
    }),
    sortOptions: z.array(optionSchema),
  }),
);
