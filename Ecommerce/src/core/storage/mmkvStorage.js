import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'arise-customer-preferences' });

export const preferencesStorage = {
  getBoolean: (key, fallback = false) => storage.getBoolean(key) ?? fallback,
  getString: (key, fallback = null) => storage.getString(key) ?? fallback,
  setBoolean: (key, value) => storage.set(key, value),
  setString: (key, value) => storage.set(key, value),
  remove: key => storage.delete(key),
  clear: () => storage.clearAll(),
};
