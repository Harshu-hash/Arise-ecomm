import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';

export const adPreferencesSchema = z.object({
  personalizedAds: z.boolean(),
  thirdPartyDataSharing: z.boolean(),
  locationBasedAds: z.boolean(),
  updatedAt: z.string().datetime(),
});
export const adPreferencesResponseSchema = apiEnvelope(adPreferencesSchema);
