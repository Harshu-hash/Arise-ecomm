import { mapAuthChallenge, mapSession } from './auth.mapper';

describe('auth DTO mappers', () => {
  it('maps a valid challenge envelope', () => {
    expect(
      mapAuthChallenge({
        data: {
          challengeId: 'challenge_1',
          destinationMasked: '+91 ******3210',
          expiresAt: '2026-11-02T17:00:00.000Z',
          resendAvailableAt: '2026-11-02T16:59:00.000Z',
          purpose: 'LOGIN',
        },
      }),
    ).toMatchObject({ challengeId: 'challenge_1', isNewCustomer: false });
  });

  it('adds a stable display name to a valid session', () => {
    const session = mapSession({
      data: {
        user: { id: 'cus_1', phone: '+919876543210', status: 'ACTIVE' },
        accessToken: 'access_1',
        refreshToken: 'refresh_1',
      },
    });

    expect(session.user.displayName).toBe('+919876543210');
  });

  it('rejects malformed backend data before it reaches a screen', () => {
    expect(() => mapSession({ data: { accessToken: 'access_without_user' } })).toThrow();
  });
});
