import { api } from '@core/api/axiosInstance';

export const returnsApi = {
  detail: (id) => api.get(`/returns/${id}`).then((r) => r.data),
  approve: (id) => api.post(`/returns/${id}/approve`, {}).then((r) => r.data),
  reject: (id, reason) => api.post(`/returns/${id}/reject`, { reason }).then((r) => r.data),
  receive: (id) => api.post(`/returns/${id}/receive`, {}).then((r) => r.data),
  qc: (id, payload) => api.post(`/returns/${id}/qc`, payload).then((r) => r.data),
};

export const returnKeys = {
  list: (p) => ['seller', 'returns', 'list', p],
  detail: (id) => ['seller', 'returns', 'detail', id],
};

export const RETURN_ACTION_LABELS = {
  approve: 'Approve & schedule pickup',
  reject: 'Reject return',
  receive: 'Mark received',
  qc: 'Record QC',
};
