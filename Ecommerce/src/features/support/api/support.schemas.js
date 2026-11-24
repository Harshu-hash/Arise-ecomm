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
export const chatMessageSchema = z.object({
  id: z.string().min(1),
  authorType: z.enum(['CUSTOMER', 'AGENT']),
  authorDisplayName: z.string().min(1),
  body: z.string().max(2000),
  attachments: z.array(z.object({ id: z.string().min(1), url: z.string().min(1) })),
  createdAt: z.string().datetime(),
});
const chatSummary = {
  id: z.string().min(1),
  status: z.enum(['OPEN', 'CLOSED']),
  orderId: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastMessageAt: z.string().datetime(),
  lastMessagePreview: z.string(),
  unreadCount: z.number().int().nonnegative(),
};
// data is null while the customer has no open chat
export const chatResponseSchema = apiEnvelope(
  z.object({ ...chatSummary, messages: z.array(chatMessageSchema) }).nullable(),
);
export const chatListResponseSchema = apiEnvelope(
  z.object({ items: z.array(z.object(chatSummary)), nextCursor: z.string().nullable() }),
);
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
