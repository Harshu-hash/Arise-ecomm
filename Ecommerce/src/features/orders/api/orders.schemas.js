import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { addressDtoSchema } from '@features/address/api/address.schemas';

export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PAYMENT_FAILED',
  'DELIVERY_FAILED',
  'CANCELLED',
]);
const orderItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  variantLabel: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  canCancel: z.boolean(),
  canReturn: z.boolean(),
});
const orderTotalsSchema = z.object({
  mrpPaise: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
  productDiscountPaise: z.number().int().nonnegative(),
  couponDiscountPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  platformFeePaise: z.number().int().nonnegative(),
  taxPaise: z.number().int().nonnegative(),
  walletCreditPaise: z.number().int().nonnegative(),
  payablePaise: z.number().int().nonnegative(),
});
export const timelineEventSchema = z.object({
  id: z.string().min(1),
  status: orderStatusSchema,
  label: z.string().min(1),
  occurredAt: z.string().datetime().nullable(),
  completed: z.boolean(),
  active: z.boolean(),
});
export const orderDtoSchema = z.object({
  id: z.string().min(1),
  placedAt: z.string().datetime(),
  status: orderStatusSchema,
  paymentMethod: z.string().min(1),
  paymentStatus: z.enum(['PAID', 'COD_PENDING', 'REFUNDED']),
  deliveryCode: z.string().length(4).nullable(),
  address: addressDtoSchema,
  items: z.array(orderItemSchema).min(1),
  totals: orderTotalsSchema,
  canCancel: z.boolean(),
  canReturn: z.boolean(),
  timeline: z.array(timelineEventSchema),
});
export const ordersResponseSchema = apiEnvelope(
  z.object({
    items: z.array(orderDtoSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
);
export const orderResponseSchema = apiEnvelope(orderDtoSchema);
export const timelineResponseSchema = apiEnvelope(
  z.object({ items: z.array(timelineEventSchema) }),
);
