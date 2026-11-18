import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const productCardDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  imageUrl: z.string().url(),
  pricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  assured: z.boolean().default(false),
  deliveryLabel: z.string().min(1),
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
    color: z.string().min(1),
    sizes: z.array(z.string().min(1)),
    deliveryAddressLabel: z.string().min(1),
    description: z.string().min(1),
    fit: z.string().min(1),
    modelInfo: z.string().min(1),
    care: z.string().min(1),
    productCode: z.string().min(1),
    manufacturer: z.string().min(1),
    countryOfOrigin: z.string().min(1),
    available: z.boolean(),
    sizeChart: sizeChartSchema.nullable().optional(),
    specifications: z.array(specificationSchema).optional(),
  }),
);
