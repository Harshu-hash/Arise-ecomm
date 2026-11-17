import { api, withIdempotency } from '@core/api/axiosInstance';

export const inventoryApi = {
  list: (params) => api.get('/inventory', params),
  recommendations: () => api.get('/inventory/recommendations').then((response) => response.data),
  ledger: (id) => api.get(`/inventory/${id}/ledger`).then((response) => response.data),
  updateStock: (id, payload) => api.patch(`/inventory/${id}/stock`, payload, withIdempotency(`inventory-stock:${id}:${payload.version}:${payload.sellable}`)).then((response) => response.data),
};

export const inventoryKeys = {
  list: (params) => ['seller', 'inventory', 'list', params],
  recommendations: ['seller', 'inventory', 'recommendations'],
  ledger: (id) => ['seller', 'inventory', 'ledger', id],
};
