import { api } from '@core/api/axiosInstance';

export const chatApi = {
  list: (status) => api.get('/chats', { status }),
  get: (id) => api.get(`/chats/${id}`),
  reply: (id, payload) => api.post(`/chats/${id}/messages`, payload),
  markRead: (id) => api.post(`/chats/${id}/read`, {}),
  agents: () => api.get('/chats/agents'),
  transfer: (id, agentId) => api.post(`/chats/${id}/transfer`, { agentId }),
  close: (id) => api.post(`/chats/${id}/close`, {}),
  /** Uploads one photo as a private chat attachment and returns its storage key. */
  uploadPhoto: (file) => {
    const body = new FormData();
    body.append('purpose', 'CHAT_ATTACHMENT');
    body.append('file', file);
    return api.post('/uploads', body).then((res) => res.data.key);
  },
};

export const chatKeys = {
  all: ['support', 'chats'],
  list: (status) => ['support', 'chats', 'list', status],
  detail: (id) => ['support', 'chats', 'detail', id],
  agents: ['support', 'chats', 'agents'],
};
