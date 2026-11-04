import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { addressDtoSchema } from '@features/address/api/address.schemas';

export const paymentSchema = z.object({
  id: z.string().min(1),
  checkoutSessionId: z.string().min(1),
  method: z.enum(['upi', 'card', 'cod', 'wallet']),
  status: z.enum([
    'CREATED',
    'REQUIRES_ACTION',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'UNKNOWN',
  ]),
  amountPaise: z.number().int().nonnegative(),
  currency: z.literal('INR'),
  providerAction: z.object({
    type: z.enum(['NONE', 'REDIRECT', 'UPI_INTENT', 'SDK']),
    url: z.string().url().nullable(),
    returnUrl: z.string().nullable().optional(),
  }),
});
export const paymentResponseSchema = apiEnvelope(paymentSchema);

export const paymentMethodsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        type: z.enum(['CARD', 'UPI']),
        brand: z.string().min(1),
        label: z.string().min(1),
        last4: z.string().length(4).nullable(),
        expiryMonth: z.number().int().min(1).max(12).nullable(),
        expiryYear: z.number().int().min(2020).nullable(),
        isDefault: z.boolean(),
      }),
    ),
  }),
);

export const paymentMethodSetupResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    status: z.enum(['CREATED', 'COMPLETED', 'EXPIRED', 'CANCELLED']),
    providerAction: z.object({
      type: z.enum(['REDIRECT', 'SDK']),
      url: z.string().url().nullable(),
      returnUrl: z.string().min(1),
    }),
    expiresAt: z.string().datetime(),
  }),
);

const orderItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  variantLabel: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
});
export const orderResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    placedAt: z.string().datetime(),
    status: z.enum(['CONFIRMED', 'PROCESSING']),
    paymentMethod: z.string().min(1),
    paymentStatus: z.enum(['PAID', 'COD_PENDING']),
    amountPaise: z.number().int().nonnegative(),
    deliveryCode: z.string().length(4),
    address: addressDtoSchema,
    items: z.array(orderItemSchema).min(1),
  }),
);
