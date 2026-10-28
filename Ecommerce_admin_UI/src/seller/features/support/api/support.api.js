import { api } from '@core/api/axiosInstance';

export const supportApi = {
  detail: (id) => api.get(`/support/tickets/${id}`).then((r) => r.data),
  create: (payload) => api.post('/support/tickets', payload).then((r) => r.data),
  reply: (id, text) => api.post(`/support/tickets/${id}/messages`, { text }).then((r) => r.data),
  close: (id) => api.post(`/support/tickets/${id}/close`, {}).then((r) => r.data),
};

export const supportKeys = {
  list: (p) => ['seller', 'support', 'tickets', p],
  detail: (id) => ['seller', 'support', 'ticket', id],
};
