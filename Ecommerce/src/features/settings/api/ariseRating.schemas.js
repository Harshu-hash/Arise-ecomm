import { z } from 'zod';

export const ariseRatingInputSchema = z.object({ rating: z.number().int().min(1).max(5) });
export const ariseRatingResponseSchema = z.object({
  data: z.object({ id: z.string().min(1), rating: z.number().int().min(1).max(5), ratedAt: z.string().datetime() }),
});
