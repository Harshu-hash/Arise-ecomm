import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

const gradientSchema = z.tuple([z.string().min(1), z.string().min(1)]);

const headerSchema = z.object({
  searchPlaceholders: z.array(z.string().min(1)).min(1),
  brandTabs: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      icon: z.string().min(1),
      badge: z.string().nullable().optional(),
      activeBg: z.string().min(1),
      activeText: z.string().min(1),
      activeIcon: z.string().min(1),
      badgeBg: z.string().min(1),
      badgeText: z.string().min(1),
      gradient: gradientSchema,
    }),
  ),
  categoryTabs: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      icon: z.string().min(1),
      gradient: gradientSchema,
    }),
  ),
});

export const homeSectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(['READY', 'ERROR']).default('READY'),
  title: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  items: z.array(z.unknown()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const homeResponseSchema = apiEnvelope(
  z.object({
    version: z.string().min(1),
    generatedAt: z.string().datetime(),
    header: headerSchema,
    sections: z.array(homeSectionSchema),
  }),
);

export const appConfigResponseSchema = apiEnvelope(
  z.object({
    minimumSupportedVersion: z.string().min(1),
    latestVersion: z.string().min(1),
    maintenance: z.object({
      enabled: z.boolean(),
      message: z.string().nullable().optional(),
    }),
    storeUrls: z.object({ android: z.string().min(1), ios: z.string().min(1) }),
    featureFlags: z.record(z.boolean()),
  }),
);

export const bannerItemSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
  target: z
    .object({ type: z.string().min(1), id: z.string().min(1).optional() })
    .nullable()
    .optional(),
});

export const recentlyViewedItemSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
});

export const adTileSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
  bannerText: z.string().min(1),
  label: z.string().min(1),
});

export const productCardSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  pricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  rating: z.number().min(0).max(5).nullable().optional(),
  ratingCount: z.number().int().nonnegative().nullable().optional(),
  badge: z.string().nullable().optional(),
  aspectRatio: z.number().positive().default(1),
});

export const brandSpotlightSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  discount: z.string().min(1),
  subtitle: z.string().min(1),
});

export const dealCardSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
  label: z.string().min(1),
  value: z.string().min(1),
  tag: z.string().nullable().optional(),
});
