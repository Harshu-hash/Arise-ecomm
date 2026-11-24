import { api } from '@core/api/axiosInstance';

export const supportApi = {
  channels: () => api.get('/support/channels').then((r) => r.data),
};

export const supportKeys = {
  channels: ['seller', 'support', 'channels'],
};
