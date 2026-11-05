import { api } from '@core/api/axiosInstance';

export const logisticsApi = {
  batch: (payload) => api.post('/logistics/batch', payload).then((response) => response.data),
  reschedulePickup: (id, payload) =>
    api.post(`/logistics/pickups/${id}/reschedule`, payload).then((response) => response.data),
  respondNdr: (id, payload) =>
    api.post(`/logistics/ndr/${id}/respond`, payload).then((response) => response.data),
  disputeWeight: (id, payload) =>
    api.post(`/logistics/weight-disputes/${id}/dispute`, payload).then((response) => response.data),
};

export const logisticsKeys = {
  list: (kind, params) => ['seller', 'logistics', kind, params],
};
