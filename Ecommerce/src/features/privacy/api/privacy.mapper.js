import { deletionEligibilityResponseSchema } from './privacy.schemas';
export const mapDeletionEligibility = payload =>
  deletionEligibilityResponseSchema.parse(payload).data;
