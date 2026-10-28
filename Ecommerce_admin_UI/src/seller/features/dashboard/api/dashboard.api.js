import { api } from '@core/api/axiosInstance';

export const sellerDashboardApi = {
  summary: () => api.get('/dashboard/summary').then((r) => r.data),
};

export const dashboardKeys = {
  summary: ['seller', 'dashboard', 'summary'],
};
