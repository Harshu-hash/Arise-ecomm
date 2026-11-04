import { profileResponseSchema } from './profile.schemas';

const labels = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};
export const mapProfile = payload => {
  const profile = profileResponseSchema.parse(payload).data;
  return { ...profile, genderLabel: labels[profile.gender] };
};
