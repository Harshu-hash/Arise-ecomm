import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  updatedAt: z.string().datetime(),
});
export const trackingResponseSchema = apiEnvelope(
  z.object({
    shipmentId: z.string().min(1),
    orderId: z.string().min(1),
    status: z.enum([
      'PROCESSING',
      'PACKED',
      'READY_TO_SHIP',
      'SHIPPED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'DELAYED',
      'DELIVERY_FAILED',
      'CANCELLED',
    ]),
    statusLabel: z.string().min(1),
    updatedAt: z.string().datetime(),
    eta: z.object({
      label: z.string().min(1),
      estimatedAt: z.string().datetime().nullable(),
      delayed: z.boolean(),
    }),
    courier: z.object({
      name: z.string().min(1),
      trackingNumber: z.string().min(1),
      supportPhone: z.string().nullable(),
    }),
    deliveryAgent: z
      .object({
        displayName: z.string().min(1),
        vehicleLabel: z.string().nullable(),
        maskedPhone: z.string().nullable(),
        contactAllowed: z.boolean(),
        location: locationSchema.nullable(),
      })
      .nullable(),
    deliveryCode: z
      .object({
        masked: z.string().min(1),
        revealAllowed: z.boolean(),
        value: z.string().length(4).nullable(),
      })
      .nullable(),
    attempts: z.array(
      z.object({
        attemptedAt: z.string().datetime(),
        outcome: z.string().min(1),
        message: z.string().min(1),
      }),
    ),
    events: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().min(1),
        occurredAt: z.string().datetime().nullable(),
        completed: z.boolean(),
        active: z.boolean(),
      }),
    ),
    pollingIntervalSeconds: z.number().int().min(15).max(300),
  }),
);
