import { api } from '@core/api/axiosInstance';

export const performanceApi = {
  health: () => api.get('/performance/health').then((r) => r.data),
  trend: () => api.get('/performance/trend').then((r) => r.data),
  ratings: () => api.get('/performance/ratings').then((r) => r.data),
  disputePenalty: (id, reason) => api.post(`/penalties/${id}/dispute`, { reason }).then((r) => r.data),
  claimDetail: (id) => api.get(`/claims/${id}`).then((r) => r.data),
  createClaim: (payload) => api.post('/claims', payload).then((r) => r.data),
};

export const performanceKeys = {
  health: ['seller', 'performance', 'health'],
  trend: ['seller', 'performance', 'trend'],
  ratings: ['seller', 'performance', 'ratings'],
  penalties: (p) => ['seller', 'penalties', p],
  claims: (p) => ['seller', 'claims', p],
  claimDetail: (id) => ['seller', 'claim', id],
};
