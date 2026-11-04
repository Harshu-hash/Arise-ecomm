import {
  communicationPreferencesResponseSchema,
  deletionEligibilityResponseSchema,
  exportRequestResponseSchema,
} from './privacy.schemas';
export const mapCommunicationPreferences = payload =>
  communicationPreferencesResponseSchema.parse(payload).data;
export const mapExportRequest = payload => exportRequestResponseSchema.parse(payload).data;
export const mapDeletionEligibility = payload =>
  deletionEligibilityResponseSchema.parse(payload).data;
