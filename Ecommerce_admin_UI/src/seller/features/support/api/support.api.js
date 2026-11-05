import { api } from '@core/api/axiosInstance';

export const supportApi = {
  detail: (id) => api.get(`/support/tickets/${id}`).then((r) => r.data),
  create: (payload) => api.post('/support/tickets', payload).then((r) => r.data),
  reply: (id, text, attachments = []) => api.post(`/support/tickets/${id}/messages`, { text, attachments }).then((r) => r.data),
  close: (id) => api.post(`/support/tickets/${id}/close`, {}).then((r) => r.data),
  reopen: (id, reason, attachments = []) => api.post(`/support/tickets/${id}/reopen`, { reason, attachments }).then((r) => r.data),
  callback: (id) => api.post(`/support/tickets/${id}/callback`, {}).then((r) => r.data),
  help: (q = '') => api.get('/support/help', { q }).then((r) => r.data),
  contextOptions: () => api.get('/support/context-options').then((r) => r.data),
  incidents: () => api.get('/support/incidents').then((r) => r.data),
};

export const supportKeys = {
  list: (p) => ['seller', 'support', 'tickets', p],
  detail: (id) => ['seller', 'support', 'ticket', id],
  help: (q) => ['seller', 'support', 'help', q],
  contextOptions: ['seller', 'support', 'context-options'],
  incidents: ['seller', 'support', 'incidents'],
};
