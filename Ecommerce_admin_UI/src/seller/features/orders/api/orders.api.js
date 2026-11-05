import { api, http } from '@core/api/axiosInstance';

export const ordersApi = {
  detail: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  confirm: (id) => api.post(`/orders/${id}/confirm`, {}).then((r) => r.data),
  pack: (id) => api.post(`/orders/${id}/pack`, {}).then((r) => r.data),
  manifest: (id) => api.post(`/orders/${id}/manifest`, {}).then((r) => r.data),
  dispatch: (id) => api.post(`/orders/${id}/dispatch`, {}).then((r) => r.data),
  action: (id, action) => api.post(`/orders/${id}/${action}`, {}).then((r) => r.data),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data),
  bulk: (action, selection) =>
    api
      .post('/orders/bulk', {
        action,
        selection: Array.isArray(selection) ? { mode: 'SELECTED', ids: selection } : selection,
      })
      .then((r) => r.data),
  createPackages: (id, packages) =>
    api.post(`/orders/${id}/packages`, { packages }).then((r) => r.data),
  split: (id, itemIds) => api.post(`/orders/${id}/split`, { itemIds }).then((r) => r.data),
  scan: (id, barcode, purpose) =>
    api.post(`/orders/${id}/scan`, { barcode, purpose }).then((r) => r.data),
  documents: (id) => api.get(`/orders/${id}/documents`).then((r) => r.data),
  generateDocument: (id, type) =>
    api.post(`/orders/${id}/documents/${type}`, {}).then((r) => r.data),
  downloadDocument: (url) =>
    http.get(url, { responseType: 'blob' }).then((response) => response.data),
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
