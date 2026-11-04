import reducer, { onboardingCompleted, onboardingRestored } from './onboarding.slice';

describe('onboarding slice', () => {
  it('restores an incomplete first-run state', () => {
    expect(reducer(undefined, onboardingRestored(false))).toEqual({
      completed: false,
      restored: true,
    });
  });

  it('marks onboarding complete', () => {
    expect(reducer(undefined, onboardingCompleted())).toEqual({
      completed: true,
      restored: true,
    });
  });
});
