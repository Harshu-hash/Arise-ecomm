import { api } from '@core/api/axiosInstance';

export const ordersApi = {
  detail: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  confirm: (id) => api.post(`/orders/${id}/confirm`, {}).then((r) => r.data),
  pack: (id) => api.post(`/orders/${id}/pack`, {}).then((r) => r.data),
  manifest: (id) => api.post(`/orders/${id}/manifest`, {}).then((r) => r.data),
  dispatch: (id) => api.post(`/orders/${id}/dispatch`, {}).then((r) => r.data),
  action: (id, action) => api.post(`/orders/${id}/${action}`, {}).then((r) => r.data),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data),
  bulk: (action, ids) => api.post('/orders/bulk', { action, ids }).then((r) => r.data),
};

export const orderKeys = {
  list: (p) => ['seller', 'orders', 'list', p],
  detail: (id) => ['seller', 'orders', 'detail', id],
};

/** The next fulfilment step → its button label. */
export const ACTION_LABELS = {
  confirm: 'Confirm order',
  pack: 'Pack & invoice',
  manifest: 'Label & manifest',
  dispatch: 'Mark dispatched',
};
