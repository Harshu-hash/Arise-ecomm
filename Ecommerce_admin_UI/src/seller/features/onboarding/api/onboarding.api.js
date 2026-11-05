import { api } from '@core/api/axiosInstance';

export const onboardingApi = {
  get: () => api.get('/onboarding').then((r) => r.data),
  status: () => api.get('/onboarding/status').then((r) => r.data),
  save: (payload) => api.patch('/onboarding', payload).then((r) => r.data),
  submit: () => api.post('/onboarding/submit', {}).then((r) => r.data),
  agreement: () => api.get('/onboarding/agreement').then((r) => r.data),
  acceptAgreement: (version) => api.post('/onboarding/agreement/accept', { version }).then((r) => r.data),
  checkPincode: (pincode) => api.get(`/onboarding/pincode/${pincode}`).then((r) => r.data),
  resubmitSection: (sectionKey, payload) => api.post(`/onboarding/sections/${sectionKey}/resubmit`, payload).then((r) => r.data),
};

export const onboardingKeys = {
  current: ['seller', 'onboarding'],
  status: ['seller', 'onboarding', 'status'],
  agreement: ['seller', 'onboarding', 'agreement'],
};
