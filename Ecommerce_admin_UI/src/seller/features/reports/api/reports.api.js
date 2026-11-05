import { api } from '@core/api/axiosInstance';

export const sellerReportsApi = {
  templates: () => api.get('/reports/templates').then((response) => response.data),
  createTemplate: (payload) => api.post('/reports/templates', payload).then((response) => response.data),
  deleteTemplate: (id) => api.delete(`/reports/templates/${id}`).then((response) => response.data),
  schedules: () => api.get('/reports/schedules').then((response) => response.data),
  createSchedule: (payload) => api.post('/reports/schedules', payload).then((response) => response.data),
  updateSchedule: (id, payload) => api.patch(`/reports/schedules/${id}`, payload).then((response) => response.data),
  deleteSchedule: (id) => api.delete(`/reports/schedules/${id}`).then((response) => response.data),
};

export const sellerReportKeys = { schedules: ['seller', 'reports', 'schedules'], templates: ['seller', 'reports', 'templates'] };

