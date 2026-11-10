import { api } from '@core/api/axiosInstance';

export const analyticsApi = {
  filters: () => api.get('/analytics/filters').then((response) => response.data),
  view: (view, params) => api.get(`/analytics/${view}`, params).then((response) => response.data),
  recommendations: () => api.get('/analytics/recommendations').then((response) => response.data),
  actOnRecommendation: (id, action, payload = {}) => api.post(`/analytics/recommendations/${id}/${action}`, payload).then((response) => response.data),
};

export const analyticsKeys = {
  filters: ['seller', 'analytics', 'filters'],
  view: (view, params) => ['seller', 'analytics', view, params],
  recommendations: ['seller', 'analytics', 'recommendations'],
};
