import reducer, {
  sessionAuthenticated,
  sessionCleared,
  sessionRestored,
  tokensRefreshed,
} from './auth.slice';

describe('auth slice', () => {
  it('restores an authenticated session', () => {
    const state = reducer(
      undefined,
      sessionRestored({
        user: { id: 'cus_1' },
        accessToken: 'access_1',
        refreshToken: 'refresh_1',
      }),
    );

    expect(state).toMatchObject({
      status: 'authenticated',
      restored: true,
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
    });
  });

  it('rotates tokens without losing the current user', () => {
    const authenticated = reducer(
      undefined,
      sessionAuthenticated({
        user: { id: 'cus_1' },
        accessToken: 'old',
        refreshToken: 'old_refresh',
      }),
    );
    const refreshed = reducer(
      authenticated,
      tokensRefreshed({ accessToken: 'new', refreshToken: 'new_refresh' }),
    );

    expect(refreshed.user).toEqual({ id: 'cus_1' });
    expect(refreshed.accessToken).toBe('new');
    expect(refreshed.refreshToken).toBe('new_refresh');
  });

  it('clears all credentials on logout or refresh failure', () => {
    const authenticated = reducer(
      undefined,
      sessionAuthenticated({
        user: { id: 'cus_1' },
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    );

    expect(reducer(authenticated, sessionCleared())).toEqual({
      status: 'anonymous',
      user: null,
      accessToken: null,
      refreshToken: null,
      restored: true,
    });
  });
});
