import { AxiosError } from 'axios';
import { getMediaFixture } from './customerMediaAdapter';

const LATENCY_MS = 200;
const initial = {
  id: 'cus_1',
  name: 'Arise Customer',
  emailMasked: 'h***@gmail.com',
  phoneMasked: '+91******3210',
  emailVerified: true,
  phoneVerified: true,
  gender: 'PREFER_NOT_TO_SAY',
  avatarUrl: null,
  pendingVerification: null,
  updatedAt: '2026-08-01T00:00:00.000Z',
};
let profile = { ...initial };
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message, fieldErrors) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message, fieldErrors } }, status),
  );
};
const maskEmail = value => {
  const [name, domain] = value.split('@');
  return `${name[0]}***@${domain}`;
};
const maskPhone = value => `${value.slice(0, 3)}******${value.slice(-4)}`;
export const resetCustomerProfileFixture = () => {
  profile = { ...initial };
};
export const customerProfileFixtureAdapter = async config => {
  await wait();
  if (config.url === '/me' && config.method === 'get') return response(config, { data: profile });
  if (config.url === '/me' && config.method === 'patch') {
    const { name, gender, newEmail, newPhone, avatarMediaId } = config.data || {};
    const fields = {};
    if (name !== undefined && (name.trim().length < 2 || name.trim().length > 80))
      fields.name = 'Enter a name between 2 and 80 characters.';
    if (gender !== undefined && !['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(gender))
      fields.gender = 'Choose a valid option.';
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))
      fields.newEmail = 'Enter a valid email address.';
    if (newPhone && !/^\+[1-9]\d{7,14}$/.test(newPhone))
      fields.newPhone = 'Use international format, for example +919876543210.';
    if (Object.keys(fields).length)
      return reject(config, 422, 'PROFILE_INVALID', 'Check the highlighted fields.', fields);
    let avatarUrl = profile.avatarUrl;
    if (avatarMediaId) {
      const media = getMediaFixture(avatarMediaId);
      if (!media) return reject(config, 422, 'AVATAR_INVALID', 'Upload the profile image again.');
      avatarUrl = media.url;
    }
    let pendingVerification = null;
    if (newEmail)
      pendingVerification = {
        challengeId: `profile-email-${Date.now()}`,
        field: 'EMAIL',
        destinationMasked: maskEmail(newEmail),
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      };
    else if (newPhone)
      pendingVerification = {
        challengeId: `profile-phone-${Date.now()}`,
        field: 'PHONE',
        destinationMasked: maskPhone(newPhone),
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      };
    profile = {
      ...profile,
      name: name?.trim() || profile.name,
      gender: gender || profile.gender,
      avatarUrl,
      pendingVerification,
      updatedAt: new Date().toISOString(),
    };
    return response(config, { data: profile });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
