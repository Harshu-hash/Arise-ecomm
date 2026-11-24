import { api } from '@core/api/axiosInstance';

export const notificationsApi = {
  broadcasts: () => api.get('/push-broadcasts').then((response) => response.data),
  audience: (platforms) => api.get('/push-broadcasts/audience', { params: { platforms: platforms.join(',') } }).then((response) => response.data),
  cancelBroadcast: (id) => api.post(`/push-broadcasts/${id}/cancel`).then((response) => response.data),
  sendBroadcast: (payload) => api.post('/push-broadcasts', payload).then((response) => response.data),
};

export const notificationKeys = {
  broadcasts: ['admin', 'notifications', 'push-broadcasts'],
  audience: (platforms) => ['admin', 'notifications', 'push-broadcasts', 'audience', platforms],
};
