import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const emailSchema = z.email().max(254).transform((value) => value.toLowerCase());
export const phoneINSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number');
// Money is always integer paise.
export const paiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const PAGINATION = Object.freeze({ DEFAULT_LIMIT: 20, MAX_LIMIT: 100 });

// Cursor pagination: stable under inserts, no deep-skip cost.
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  cursor: z.string().max(256).optional(),
});
