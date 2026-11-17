import { api } from '@core/api/axiosInstance';

export const notificationsApi = {
  broadcasts: () => api.get('/push-broadcasts').then((response) => response.data),
  sendBroadcast: (payload) => api.post('/push-broadcasts', payload).then((response) => response.data),
};

export const notificationKeys = {
  broadcasts: ['admin', 'notifications', 'push-broadcasts'],
};
