import { apiClient } from '@core/api';
import { pushTokenStorage } from '../storage/pushTokenStorage';
export const registerPushToken = async ({ deviceId, token, platform }) => {
  const current = pushTokenStorage.get();
  if (current?.token === token && current?.deviceId === deviceId) return current;
  await apiClient.post('/devices/push-tokens', { deviceId, token, platform });
  const registration = { deviceId, token, platform };
  pushTokenStorage.set(registration);
  return registration;
};
export const unregisterStoredPushToken = async () => {
  const registration = pushTokenStorage.get();
  if (!registration) return;
  try {
    await apiClient.delete(`/devices/push-tokens/${encodeURIComponent(registration.deviceId)}`);
  } finally {
    pushTokenStorage.clear();
  }
};
