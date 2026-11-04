import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { productCardDtoSchema } from '@features/product/api/product.schemas';

const couponSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  discountPaise: z.number().int().nonnegative(),
  minimumSubtotalPaise: z.number().int().nonnegative(),
});

const cartItemSchema = productCardDtoSchema.extend({
  cartItemId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  variantLabel: z.string().min(1),
  offerId: z.string().min(1),
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
  quantity: z.number().int().positive(),
  minimumQuantity: z.number().int().positive(),
  maximumQuantity: z.number().int().positive(),
  available: z.boolean(),
  issueCode: z.string().nullable(),
});

const totalsSchema = z.object({
  mrpPaise: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
  productDiscountPaise: z.number().int().nonnegative(),
  couponDiscountPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  platformFeePaise: z.number().int().nonnegative(),
  payablePaise: z.number().int().nonnegative(),
});

export const cartResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    version: z.number().int().nonnegative(),
    items: z.array(cartItemSchema),
    savedItems: z.array(cartItemSchema),
    appliedCoupon: couponSchema.nullable(),
    totals: totalsSchema,
    checkoutAllowed: z.boolean(),
    issues: z.array(
      z.object({
        code: z.string().min(1),
        message: z.string().min(1),
        cartItemId: z.string().nullable(),
        blocking: z.boolean(),
      }),
    ),
  }),
);

export const eligibleCouponsResponseSchema = apiEnvelope(
  z.object({ items: z.array(couponSchema) }),
);
