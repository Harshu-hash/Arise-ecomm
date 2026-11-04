import { preferencesStorage } from '@core/storage/mmkvStorage';
import {
  onboardingCompleted,
  onboardingRestored,
} from '@features/onboarding/redux/onboarding.slice';

export const ONBOARDING_COMPLETED_KEY = 'onboarding.completed.v1';

export const restoreAppPreferences = (dispatch, { storage = preferencesStorage } = {}) => {
  let completed = false;
  try {
    completed = storage.getBoolean(ONBOARDING_COMPLETED_KEY, false);
  } catch {
    // Corrupt or unavailable preferences should fall back to first-run UX.
  }
  dispatch(onboardingRestored(completed));
  return completed;
};

export const persistOnboardingCompletion = (dispatch, { storage = preferencesStorage } = {}) => {
  let persisted = true;
  try {
    storage.setBoolean(ONBOARDING_COMPLETED_KEY, true);
  } catch {
    persisted = false;
  }
  dispatch(onboardingCompleted());
  return persisted;
};
