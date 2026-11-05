import { useSessionStore } from '@core/auth/sessionStore';
import { sellerAuthApi } from '@seller/features/auth/api/auth.api';

export async function signInSeller(email = 'owner@arise.test', password = 'Arise@123456') {
  const challenge = await sellerAuthApi.login({ email, password });
  const request = { challengeId: challenge.challengeId, code: challenge.devHint.code };
  const payload = challenge.stage === 'enrol_2fa'
    ? await sellerAuthApi.enrol2fa(request)
    : await sellerAuthApi.verify2fa(request);
  useSessionStore.getState().setAuthenticated(payload);
  return payload.user;
}

