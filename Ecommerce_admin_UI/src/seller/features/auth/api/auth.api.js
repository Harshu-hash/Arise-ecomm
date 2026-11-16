import { api } from '@core/api/axiosInstance';
import { IS_MOCK } from '@core/config/env';

function mockRegistrationPayload(form) {
  if (!(form instanceof FormData)) return form;
  return Object.fromEntries([...form.entries()].map(([key, value]) => [
    key,
    typeof value === 'string' ? value : { name: value.name, type: value.type, size: value.size },
  ]));
}

/** Seller auth endpoints. All resolve to the unwrapped `data` payload. */
export const sellerAuthApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  checkRegistrationExists: (payload) => api.post('/auth/register/check-exists', payload).then((r) => r.data),
  sendRegistrationOtp: (payload) => api.post('/auth/register/send-otp', payload).then((r) => r.data),
  verifyRegistrationOtp: (payload) => api.post('/auth/register/verify-otp', payload).then((r) => r.data),
  verify2fa: (payload) => api.post('/auth/2fa/verify', payload).then((r) => r.data),
  enrol2fa: (payload) => api.post('/auth/2fa/enrol', payload).then((r) => r.data),
  register: (payload) => api.post(
    '/auth/register',
    IS_MOCK ? mockRegistrationPayload(payload) : payload,
    IS_MOCK ? undefined : { headers: { 'Content-Type': 'multipart/form-data' } },
  ).then((r) => r.data),
  applicationStatus: (id) => api.get(`/auth/application-status/${id}`).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (payload) => api.post('/auth/reset-password', payload).then((r) => r.data),
  getInvite: (token) => api.get(`/auth/invite/${token}`).then((r) => r.data),
  acceptInvite: (payload) => api.post('/auth/invite/accept', payload).then((r) => r.data),
  changePassword: (payload) => api.post('/me/password', payload).then((r) => r.data),
};
