import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const productCardDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string(),
  category: z.string(),
  imageUrl: z.string().url(),
  pricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  rating: z.number().min(0).max(5).nullable().optional(),
  ratingCount: z.number().int().nonnegative().default(0),
  assured: z.boolean().default(false),
  deliveryLabel: z.string().nullable().optional(),
});

// A size chart's shape is generic: `columns` are the header labels in order,
// each `rows` entry is the same length with the size value first — so the
// screen can render any category's chart (shirts, footwear, …) the same way.
const sizeChartSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.string().min(1))).min(1),
});

// Free-form category attributes (fabric, connectivity, capacity, …) that have
// no dedicated field on the product, shown as a generic spec list.
const specificationSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const productDetailResponseSchema = apiEnvelope(
  productCardDtoSchema.extend({
    images: z.array(z.string().url()).min(1),
    reviewCount: z.number().int().nonnegative(),
    color: z.string().default(''),
    sizes: z.array(z.string().min(1)),
    deliveryAddressLabel: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    fit: z.string().nullable().optional(),
    modelInfo: z.string().nullable().optional(),
    care: z.string().nullable().optional(),
    productCode: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    available: z.boolean(),
    // One entry per sellable variant: its own price, stock and photos.
    variants: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().nullable().optional(),
          color: z.string().nullable().optional(),
          size: z.string().nullable().optional(),
          pricePaise: z.number().int().nonnegative(),
          mrpPaise: z.number().int().positive(),
          stock: z.number().int().nonnegative(),
          images: z.array(z.string().url()).default([]),
        }),
      )
      .default([]),
    sizeChart: sizeChartSchema.nullable().optional(),
    specifications: z.array(specificationSchema).optional(),
  }),
);
