import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const addressDtoSchema = z.object({
  id: z.string().min(1),
  label: z.enum(['Home', 'Work', 'Other']),
  isDefault: z.boolean(),
  name: z.string().min(2),
  phone: z.string().regex(/^\+?[0-9 ]{10,16}$/),
  line: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
});

export const addressesResponseSchema = apiEnvelope(
  z.object({ items: z.array(addressDtoSchema), defaultAddressId: z.string().nullable() }),
);
export const addressResponseSchema = apiEnvelope(addressDtoSchema);
export const addressValidationResponseSchema = apiEnvelope(
  z.object({ valid: z.literal(true), normalizedAddress: addressDtoSchema.omit({ id: true }) }),
);
export const serviceabilityResponseSchema = apiEnvelope(
  z.object({
    pincode: z.string().length(6),
    serviceable: z.boolean(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    estimatedDeliveryDays: z.number().int().positive().nullable(),
    message: z.string().min(1),
  }),
);
