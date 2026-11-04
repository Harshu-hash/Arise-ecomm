import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
export const supportChannelsResponseSchema = apiEnvelope(
  z.object({
    availabilityLabel: z.string().min(1),
    channels: z.array(
      z.object({
        id: z.string().min(1),
        type: z.enum(['PHONE', 'EMAIL', 'CHAT', 'URL']),
        label: z.string().min(1),
        description: z.string().min(1),
        href: z.string().min(1),
        enabled: z.boolean(),
      }),
    ),
  }),
);
export const subjectSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  requiresOrder: z.boolean(),
  allowsAttachments: z.boolean(),
});
export const subjectsResponseSchema = apiEnvelope(z.object({ items: z.array(subjectSchema) }));
export const ticketMessageSchema = z.object({
  id: z.string().min(1),
  authorType: z.enum(['CUSTOMER', 'AGENT', 'SYSTEM']),
  authorDisplayName: z.string().min(1),
  body: z.string().min(1).max(4000),
  attachmentMediaIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export const ticketSchema = z.object({
  id: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectLabel: z.string().min(1),
  description: z.string().min(10),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED']),
  orderId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  firstResponseDueAt: z.string().datetime().nullable(),
  resolutionDueAt: z.string().datetime().nullable(),
  canReply: z.boolean(),
  messages: z.array(ticketMessageSchema),
});
export const ticketsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(ticketSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
);
export const ticketResponseSchema = apiEnvelope(ticketSchema);
export const helpArticleSummarySchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  version: z.number().int().positive(),
  publishedAt: z.string().datetime(),
});
export const helpCategorySchema = z.object({
  id: z.string().min(1),
  icon: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  articles: z.array(helpArticleSummarySchema),
});
export const helpCategoriesResponseSchema = apiEnvelope(
  z.object({ items: z.array(helpCategorySchema) }),
);
export const helpCategoryResponseSchema = apiEnvelope(helpCategorySchema);
export const helpArticleResponseSchema = apiEnvelope(
  helpArticleSummarySchema.extend({
    body: z.string().min(1),
    viewerFeedback: z.enum(['HELPFUL', 'NOT_HELPFUL']).nullable(),
  }),
);
export const helpSearchResponseSchema = apiEnvelope(
  z.object({
    items: z.array(helpArticleSummarySchema),
    query: z.string(),
    total: z.number().int().nonnegative(),
  }),
);
