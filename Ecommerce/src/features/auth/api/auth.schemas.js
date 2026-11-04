import { z } from 'zod';

export const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: z.string().min(1).default('ACTIVE'),
});

export const authChallengeSchema = z.object({
  challengeId: z.string().min(1),
  destinationMasked: z.string().min(1),
  expiresAt: z.string().datetime(),
  resendAvailableAt: z.string().datetime(),
  purpose: z.enum(['LOGIN', 'SIGNUP', 'PASSWORD_RESET']),
  isNewCustomer: z.boolean().default(false),
});

export const sessionSchema = z.object({
  user: customerSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const passwordResetVerificationSchema = z.object({
  resetToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const passwordResetResultSchema = z.object({
  success: z.literal(true),
});

export const apiEnvelope = schema =>
  z.object({ data: schema, meta: z.record(z.unknown()).optional() });
