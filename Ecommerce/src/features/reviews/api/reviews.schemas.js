import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const reviewDtoSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  productImageUrl: z.string().url(),
  orderItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100),
  body: z.string().min(10).max(2000),
  media: z
    .array(z.object({ id: z.string(), thumbnailUrl: z.string().url(), url: z.string().url() }))
    .max(5),
  authorDisplayName: z.string().min(1),
  verifiedPurchase: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  moderationStatus: z.enum(['PENDING', 'PUBLISHED', 'REJECTED']),
  rejectionReason: z.string().nullable(),
  allowedActions: z.array(z.enum(['EDIT', 'DELETE'])),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const reviewsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(reviewDtoSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    summary: z
      .object({ average: z.number().min(0).max(5), count: z.number().int().nonnegative() })
      .nullable(),
  }),
);
export const reviewResponseSchema = apiEnvelope(reviewDtoSchema);
export const reviewEligibilityResponseSchema = apiEnvelope(
  z.object({
    orderItemId: z.string().min(1),
    productId: z.string().min(1),
    productName: z.string().min(1),
    productImageUrl: z.string().url(),
    eligible: z.boolean(),
    reason: z.string().nullable(),
    existingReviewId: z.string().nullable(),
  }),
);
export const answerDtoSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(2).max(2000),
  authorDisplayName: z.string().min(1),
  authorType: z.enum(['CUSTOMER', 'SELLER', 'BRAND', 'SUPPORT']),
  helpfulCount: z.number().int().nonnegative(),
  viewerFoundHelpful: z.boolean(),
  moderationStatus: z.enum(['PENDING', 'PUBLISHED', 'REJECTED']),
  createdAt: z.string().datetime(),
});
export const questionDtoSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  body: z.string().min(5).max(500),
  authorDisplayName: z.string().min(1),
  answersCount: z.number().int().nonnegative(),
  answerPreview: answerDtoSchema.nullable(),
  moderationStatus: z.enum(['PENDING', 'PUBLISHED', 'REJECTED']),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const questionsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(questionDtoSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
);
export const questionResponseSchema = apiEnvelope(
  questionDtoSchema.extend({ answers: z.array(answerDtoSchema) }),
);
export const answerResponseSchema = apiEnvelope(answerDtoSchema);
