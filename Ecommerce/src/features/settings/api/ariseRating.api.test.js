import { ariseRatingInputSchema } from './ariseRating.schemas';

test('Arise rating accepts only whole stars from one to five', () => {
  expect(ariseRatingInputSchema.parse({ rating: 5 })).toEqual({ rating: 5 });
  for (const rating of [0, 1.5, 6]) expect(ariseRatingInputSchema.safeParse({ rating }).success).toBe(false);
});
