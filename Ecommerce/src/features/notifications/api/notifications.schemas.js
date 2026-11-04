import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
export const notificationDtoSchema = z.object({
  id: z.string().min(1),
  deduplicationKey: z.string().min(1),
  category: z.enum(['ORDER', 'DELIVERY', 'OFFER', 'ACCOUNT', 'SUPPORT']),
  title: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
  target: z.object({
    type: z.enum(['NONE', 'PRODUCT', 'ORDER', 'SHIPMENT', 'TICKET']),
    entityId: z.string().min(1).nullable(),
  }),
});
export const notificationsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(notificationDtoSchema),
    unreadCount: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
);
export const notificationResponseSchema = apiEnvelope(notificationDtoSchema);
export const notificationPreferencesResponseSchema = apiEnvelope(
  z.object({
    orders: z.boolean(),
    delivery: z.boolean(),
    offers: z.boolean(),
    account: z.boolean(),
    support: z.boolean(),
    pushPermission: z.enum(['NOT_DETERMINED', 'GRANTED', 'DENIED']),
    updatedAt: z.string().datetime(),
  }),
);
export const deviceRegistrationResponseSchema = apiEnvelope(
  z.object({ registered: z.boolean(), deviceId: z.string().min(1) }),
);
