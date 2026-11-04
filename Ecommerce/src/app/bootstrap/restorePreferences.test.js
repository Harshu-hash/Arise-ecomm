import {
  ONBOARDING_COMPLETED_KEY,
  persistOnboardingCompletion,
  restoreAppPreferences,
} from './restorePreferences';

describe('app preference bootstrap', () => {
  it('restores persisted onboarding completion', () => {
    const dispatch = jest.fn();
    const storage = { getBoolean: jest.fn().mockReturnValue(true) };

    expect(restoreAppPreferences(dispatch, { storage })).toBe(true);
    expect(storage.getBoolean).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, false);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'onboarding/onboardingRestored', payload: true }),
    );
  });

  it('falls back to first-run UX when preferences cannot be read', () => {
    const dispatch = jest.fn();
    const storage = {
      getBoolean: jest.fn(() => {
        throw new Error('corrupt');
      }),
    };

    expect(restoreAppPreferences(dispatch, { storage })).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'onboarding/onboardingRestored', payload: false }),
    );
  });

  it('continues in memory if onboarding persistence is unavailable', () => {
    const dispatch = jest.fn();
    const storage = {
      setBoolean: jest.fn(() => {
        throw new Error('unavailable');
      }),
    };

    expect(persistOnboardingCompletion(dispatch, { storage })).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'onboarding/onboardingCompleted' }),
    );
  });
});
