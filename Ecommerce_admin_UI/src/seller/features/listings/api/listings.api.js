import { api } from '@core/api/axiosInstance';

export const listingsApi = {
  detail: (id) => api.get(`/listings/${id}`).then((r) => r.data),
  create: (payload) => api.post('/listings', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/listings/${id}`, payload).then((r) => r.data),
  setPrice: (id, value) =>
    api
      .patch(
        `/listings/${id}/price`,
        typeof value === 'object' ? value : { sellingPricePaise: value },
      )
      .then((r) => r.data),
  setStock: (id, stock) => api.patch(`/listings/${id}/stock`, { stock }).then((r) => r.data),
  resubmit: (id) => api.post(`/listings/${id}/resubmit`, {}).then((r) => r.data),
  lifecycle: (id, action, payload) =>
    api.post(`/listings/${id}/${action}`, payload ?? {}).then((r) => r.data),
  updateVariant: (id, payload) => api.patch(`/listings/${id}/variant`, payload).then((r) => r.data),
  feePreview: (payload) => api.post('/listings/fee-preview', payload).then((r) => r.data),
  preview: (id) => api.get(`/listings/${id}/preview`).then((r) => r.data),
  bulk: (rows) => api.post('/listings/bulk', { rows }).then((r) => r.data),
  bulkTemplates: (categoryId, operation) =>
    api.get('/listings/bulk-jobs/template', { categoryId, operation }).then((r) => r.data),
  bulkPreflight: (payload) =>
    api.post('/listings/bulk-jobs/preflight', payload).then((r) => r.data),
  createBulkJob: (payload) => api.post('/listings/bulk-jobs', payload).then((r) => r.data),
  bulkJobs: () => api.get('/listings/bulk-jobs').then((r) => r.data),
  bulkJob: (id) => api.get(`/listings/bulk-jobs/${id}`).then((r) => r.data),
  retryBulkJob: (id, rows) =>
    api.post(`/listings/bulk-jobs/${id}/retry`, { rows }).then((r) => r.data),
  catalogSearch: (params) => api.get('/catalog/search', params).then((r) => r.data),
  catalogProduct: (id) => api.get(`/catalog/products/${id}`).then((r) => r.data),
  attachOffers: (id, payload) =>
    api.post(`/catalog/products/${id}/offers`, payload).then((r) => r.data),
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
  catalogSearch: (q) => ['seller', 'catalog', 'search', q],
  catalogProduct: (id) => ['seller', 'catalog', 'product', id],
  bulkJobs: ['seller', 'listings', 'bulkJobs'],
};
