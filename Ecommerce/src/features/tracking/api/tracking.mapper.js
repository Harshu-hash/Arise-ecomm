import { trackingResponseSchema } from './tracking.schemas';

export const mapTracking = payload => trackingResponseSchema.parse(payload).data;
