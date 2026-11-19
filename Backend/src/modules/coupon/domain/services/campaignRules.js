import { CAMPAIGN_TRANSITIONS } from '../constants/campaign.js';

export const canTransition = (from, to) => CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false;

// Returns field errors for an inconsistent schedule, or null when it is fine.
export function windowErrors({ startsAt, endsAt, submissionDeadline }) {
  if (startsAt >= endsAt) return { endsAt: ['The end must be after the start.'] };
  if (submissionDeadline && submissionDeadline >= endsAt) {
    return { submissionDeadline: ['Sellers must finish entering before the campaign ends.'] };
  }
  return null;
}
