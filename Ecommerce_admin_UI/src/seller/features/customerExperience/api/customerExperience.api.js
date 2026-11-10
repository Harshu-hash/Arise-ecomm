import { api } from '@core/api/axiosInstance';

export const customerExperienceApi = {
  replyReview: (id, text) => api.post(`/customer-experience/reviews/${id}/reply`, { text }).then((r) => r.data),
  reportReview: (id, payload) => api.post(`/customer-experience/reviews/${id}/report`, payload).then((r) => r.data),
  answerQuestion: (id, text) => api.post(`/customer-experience/questions/${id}/answers`, { text }).then((r) => r.data),
  messagePolicy: () => api.get('/customer-experience/messages/policy').then((r) => r.data),
  conversations: () => api.get('/customer-experience/messages').then((r) => r.data),
  conversation: (id) => api.get(`/customer-experience/messages/${id}`).then((r) => r.data),
  sendMessage: (id, text) => api.post(`/customer-experience/messages/${id}`, { text }).then((r) => r.data),
};

export const customerExperienceKeys = {
  reviews: (params) => ['seller', 'customer-experience', 'reviews', params],
  questions: (params) => ['seller', 'customer-experience', 'questions', params],
  conversations: ['seller', 'customer-experience', 'messages'],
  conversation: (id) => ['seller', 'customer-experience', 'messages', id],
  policy: ['seller', 'customer-experience', 'policy'],
};
