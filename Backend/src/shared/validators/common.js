import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const emailSchema = z.email().max(254).transform((value) => value.toLowerCase());
export const phoneINSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number');
export const accountNumberSchema = z.string().trim().regex(/^\d{9,18}$/, 'Enter a valid account number.');
export const ifscSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z\d]{6}$/, 'Enter a valid 11-character IFSC code.');
// Money is always integer paise.
export const paiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const PAGINATION = Object.freeze({ DEFAULT_LIMIT: 20, MAX_LIMIT: 100 });

// Cursor pagination: stable under inserts, no deep-skip cost.
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  cursor: z.string().max(256).optional(),
});

// Offset pagination for admin tables: `sort` is `field` or `-field`; unknown fields fall back to `fallback`.
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().max(100).optional(),
  sort: z.string().default(''),
});

export function parseSort(sort, allowed, fallback) {
  const field = sort.replace(/^-/, '');
  return allowed.includes(field)
    ? { sortField: field, sortDirection: sort.startsWith('-') ? -1 : 1 }
    : { sortField: fallback, sortDirection: 1 };
}

export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
