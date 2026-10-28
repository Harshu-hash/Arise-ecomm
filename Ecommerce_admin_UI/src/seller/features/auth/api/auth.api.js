import { api } from '@core/api/axiosInstance';

/** Seller auth endpoints. All resolve to the unwrapped `data` payload. */
export const sellerAuthApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (payload) => api.post('/auth/reset-password', payload).then((r) => r.data),
  getInvite: (token) => api.get(`/auth/invite/${token}`).then((r) => r.data),
  acceptInvite: (payload) => api.post('/auth/invite/accept', payload).then((r) => r.data),
  changePassword: (payload) => api.post('/me/password', payload).then((r) => r.data),
};
