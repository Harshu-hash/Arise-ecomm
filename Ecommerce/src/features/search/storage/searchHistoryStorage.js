import { preferencesStorage } from '@core/storage/mmkvStorage';

const SEARCH_HISTORY_KEY = 'search.recent.v1';
const MAX_RECENT_SEARCHES = 8;

export const searchHistoryStorage = {
  get() {
    try {
      const value = preferencesStorage.getString(SEARCH_HISTORY_KEY, '[]');
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  },
  add(query) {
    const trimmed = query.trim();
    if (!trimmed) return this.get();
    const next = [
      trimmed,
      ...this.get().filter(item => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);
    preferencesStorage.setString(SEARCH_HISTORY_KEY, JSON.stringify(next));
    return next;
  },
  clear() {
    preferencesStorage.remove(SEARCH_HISTORY_KEY);
  },
};
