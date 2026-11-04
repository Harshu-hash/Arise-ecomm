import { CUSTOMER_AUTH_FIXTURE_OTP, customerAuthFixtureAdapter } from './customerAuthAdapter';

const request = (url, data) =>
  customerAuthFixtureAdapter({ url, method: 'post', data: JSON.stringify(data) });

describe('customerAuthFixtureAdapter', () => {
  it('implements the login challenge and session contract', async () => {
    const started = await request('/auth/start', {
      identifier: 'customer@example.com',
      purpose: 'LOGIN',
    });
    const challenge = started.data.data;

    await expect(
      request('/auth/verify-otp', { challengeId: challenge.challengeId, otp: '0000' }),
    ).rejects.toMatchObject({ response: { status: 422 } });

    const verified = await request('/auth/verify-otp', {
      challengeId: challenge.challengeId,
      otp: CUSTOMER_AUTH_FIXTURE_OTP,
    });
    expect(verified.data.data).toMatchObject({
      user: { email: 'customer@example.com' },
      accessToken: expect.stringMatching(/^fixture_access_/),
      refreshToken: expect.stringMatching(/^fixture_refresh_/),
    });
  });

  it('keeps password reset separate from an authenticated session', async () => {
    const started = await request('/auth/start', {
      identifier: '+919876543210',
      purpose: 'PASSWORD_RESET',
    });
    const verification = await request('/auth/password/verify-otp', {
      challengeId: started.data.data.challengeId,
      otp: CUSTOMER_AUTH_FIXTURE_OTP,
    });
    const resetToken = verification.data.data.resetToken;

    await expect(
      request('/auth/password/reset', { resetToken, password: 'short' }),
    ).rejects.toMatchObject({ response: { status: 422 } });
    await expect(
      request('/auth/password/reset', { resetToken, password: 'new-password-123' }),
    ).resolves.toMatchObject({ data: { data: { success: true } } });
  });
});
