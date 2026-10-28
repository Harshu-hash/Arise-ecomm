import { api } from '@core/api/axiosInstance';

export const inventoryApi = {
  warehouses: () => api.get('/warehouses').then((r) => r.data),
  createRemoval: (id, payload) => api.post(`/inventory/${id}/removal`, payload).then((r) => r.data),
  inboundDetail: (id) => api.get(`/inbound/${id}`).then((r) => r.data),
  createInbound: (payload) => api.post('/inbound', payload).then((r) => r.data),
  submitInbound: (id) => api.post(`/inbound/${id}/submit`, {}).then((r) => r.data),
  cancelInbound: (id) => api.post(`/inbound/${id}/cancel`, {}).then((r) => r.data),
  // Seller's own listings, as the SKU source for an inbound consignment.
  myListings: () => api.get('/listings', { pageSize: 500 }).then((r) => r.data),
};

export const inventoryKeys = {
  list: (p) => ['seller', 'inventory', 'list', p],
  inboundList: (p) => ['seller', 'inbound', 'list', p],
  inboundDetail: (id) => ['seller', 'inbound', 'detail', id],
  warehouses: ['seller', 'warehouses'],
};
