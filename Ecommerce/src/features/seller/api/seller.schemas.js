import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const sellerLeadInputSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/),
  mobile: z.string().trim().regex(/^\+?[1-9][0-9]{9,14}$/),
  pickupPincode: z.string().trim().regex(/^[1-9][0-9]{5}$/),
  consentVersion: z.string().min(1),
});

export const sellerLeadResponseSchema = apiEnvelope(
  z.object({
    id: z.string().min(1),
    status: z.enum(['RECEIVED', 'UNDER_REVIEW', 'CONTACTED']),
    submittedAt: z.string().datetime(),
  }),
);
