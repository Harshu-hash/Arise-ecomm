import { api } from '@core/api/axiosInstance';

export const listingsApi = {
  detail: (id) => api.get(`/listings/${id}`).then((r) => r.data),
  create: (payload) => api.post('/listings', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/listings/${id}`, payload).then((r) => r.data),
  setPrice: (id, sellingPricePaise) => api.patch(`/listings/${id}/price`, { sellingPricePaise }).then((r) => r.data),
  setStock: (id, stock) => api.patch(`/listings/${id}/stock`, { stock }).then((r) => r.data),
  resubmit: (id) => api.post(`/listings/${id}/resubmit`, {}).then((r) => r.data),
  bulk: (rows) => api.post('/listings/bulk', { rows }).then((r) => r.data),
  categories: () => api.get('/catalog/categories').then((r) => r.data),
  categoryAttributes: (id) => api.get(`/catalog/categories/${id}/attributes`).then((r) => r.data),
  brands: () => api.get('/catalog/brands').then((r) => r.data),
  createBrandRequest: (payload) => api.post('/brand-requests', payload).then((r) => r.data),
};

export const listingKeys = {
  list: (p) => ['seller', 'listings', 'list', p],
  detail: (id) => ['seller', 'listings', 'detail', id],
  categories: ['seller', 'catalog', 'categories'],
  brands: ['seller', 'catalog', 'brands'],
  brandRequests: (p) => ['seller', 'brandRequests', p],
};
