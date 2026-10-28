import { api } from '@core/api/axiosInstance';

export const catalogApi = {
  products: (params) => api.get('/products', params),
  product: (id) => api.get(`/products/${id}`),
  updateProduct: (id, payload) => api.patch(`/products/${id}`, payload),
  productAction: (id, action, payload) => api.post(`/products/${id}/${action}`, payload ?? {}),
  deactivateOffer: (id, payload) => api.post(`/offers/${id}/deactivate`, payload),

  submissions: (params) => api.get('/listing-submissions', params),
  claimSubmission: (id) => api.post(`/listing-submissions/${id}/claim`, {}),
  decideSubmission: (id, payload) => api.post(`/listing-submissions/${id}/decide`, payload),

  categories: (params) => api.get('/categories', params),
  categoryTree: () => api.get('/categories/tree'),
  category: (id) => api.get(`/categories/${id}`),
  createCategory: (payload) => api.post('/categories', payload),
  updateCategory: (id, payload) => api.patch(`/categories/${id}`, payload),
  deleteCategory: (id) => api.delete(`/categories/${id}`),

  attributes: (params) => api.get('/attributes', params),
  createAttribute: (payload) => api.post('/attributes', payload),
  updateAttribute: (id, payload) => api.patch(`/attributes/${id}`, payload),
  deleteAttribute: (id) => api.delete(`/attributes/${id}`),

  attributeSets: () => api.get('/attributes', { pageSize: 1 }).then((res) => res.meta?.sets ?? []),
  createAttributeSet: (payload) => api.post('/attribute-sets', payload),
  updateAttributeSet: (id, payload) => api.patch(`/attribute-sets/${id}`, payload),
  deleteAttributeSet: (id) => api.delete(`/attribute-sets/${id}`),

  brands: (params) => api.get('/brands', params),
  createBrand: (payload) => api.post('/brands', payload),
  updateBrand: (id, payload) => api.patch(`/brands/${id}`, payload),
  deleteBrand: (id) => api.delete(`/brands/${id}`),

  hsnCodes: (params) => api.get('/hsn-codes', params),
  createHsnCode: (payload) => api.post('/hsn-codes', payload),
  updateHsnCode: (id, payload) => api.patch(`/hsn-codes/${id}`, payload),

  sizeCharts: () => api.get('/size-charts'),
  updateSizeChart: (id, payload) => api.patch(`/size-charts/${id}`, payload),

  buyBoxRules: () => api.get('/catalog/buybox-rules'),
  simulateBuyBox: (payload) => api.post('/catalog/buybox-rules/simulate', payload),
  publishBuyBoxRules: (payload) => api.patch('/catalog/buybox-rules', payload),

  imports: (params) => api.get('/catalog/imports', params),
  commitImport: (payload) => api.post('/catalog/imports', payload),
  retryImport: (jobId) => api.post(`/catalog/imports/${jobId}/retry`, {}),
};

export const catalogKeys = {
  all: ['catalog'],
  products: (p) => ['catalog', 'products', p],
  product: (id) => ['catalog', 'product', id],
  submissions: (p) => ['catalog', 'submissions', p],
  categories: (p) => ['catalog', 'categories', p],
  categoryTree: ['catalog', 'categoryTree'],
  category: (id) => ['catalog', 'category', id],
  attributes: (p) => ['catalog', 'attributes', p],
  attributeSets: ['catalog', 'attributeSets'],
  brands: (p) => ['catalog', 'brands', p],
  hsn: (p) => ['catalog', 'hsn', p],
  sizeCharts: ['catalog', 'sizeCharts'],
  buyBoxRules: ['catalog', 'buyBoxRules'],
  imports: (p) => ['catalog', 'imports', p],
};
