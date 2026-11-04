import { preferencesStorage } from '@core/storage/mmkvStorage';
const KEY = 'push_registration';
export const pushTokenStorage = {
  get: () => {
    const value = preferencesStorage.getString(KEY);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },
  set: value => preferencesStorage.setString(KEY, JSON.stringify(value)),
  clear: () => preferencesStorage.remove(KEY),
};
