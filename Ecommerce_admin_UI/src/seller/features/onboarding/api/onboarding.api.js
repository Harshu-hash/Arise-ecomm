import { api } from '@core/api/axiosInstance';

export const onboardingApi = {
  get: () => api.get('/onboarding').then((r) => r.data),
  save: (payload) => api.patch('/onboarding', payload).then((r) => r.data),
  submit: () => api.post('/onboarding/submit', {}).then((r) => r.data),
};

export const onboardingKeys = {
  current: ['seller', 'onboarding'],
};
