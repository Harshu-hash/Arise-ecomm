import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

const resolutionSchema = z.enum(['REFUND', 'REPLACEMENT']);
export const returnEligibilityResponseSchema = apiEnvelope(
  z.object({
    orderId: z.string().min(1),
    items: z.array(
      z.object({
        orderItemId: z.string().min(1),
        productId: z.string().min(1),
        name: z.string().min(1),
        imageUrl: z.string().url(),
        quantity: z.number().int().positive(),
        eligible: z.boolean(),
        ineligibleReason: z.string().nullable(),
        returnWindowEndsAt: z.string().datetime().nullable(),
        allowedResolutions: z.array(resolutionSchema),
      }),
    ),
    reasons: z.array(
      z.object({
        code: z.string().min(1),
        label: z.string().min(1),
        requiresEvidence: z.boolean(),
      }),
    ),
    pickupRequired: z.boolean(),
    refundDestinations: z.array(z.enum(['ORIGINAL_PAYMENT', 'BANK_ACCOUNT', 'STORE_CREDIT'])),
  }),
);
export const returnRequestSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  orderItemId: z.string().min(1),
  resolution: resolutionSchema,
  reasonCode: z.string().min(1),
  status: z.enum([
    'REQUESTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'RECEIVED',
    'QC_PASSED',
    'QC_FAILED',
    'APPROVED',
    'REJECTED',
    'REFUND_INITIATED',
    'REFUND_COMPLETED',
    'REPLACEMENT_SHIPPED',
    'CANCELLED',
  ]),
  pickupAddressId: z.string().min(1),
  pickupWindowLabel: z.string().min(1),
  evidenceMediaIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  refund: z.object({
    status: z.enum(['NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
    amountPaise: z.number().int().nonnegative(),
    destination: z.enum(['ORIGINAL_PAYMENT', 'BANK_ACCOUNT', 'STORE_CREDIT']),
  }),
});
export const returnResponseSchema = apiEnvelope(returnRequestSchema);
