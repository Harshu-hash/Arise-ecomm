import { api, withIdempotency } from './axiosInstance';

export const foundationKeys = {
  media: (id) => ['foundation', 'media', id],
  jobs: ['foundation', 'jobs'],
  job: (id) => ['foundation', 'jobs', id],
  savedViews: (tableId) => ['foundation', 'savedViews', tableId],
};

export const mediaApi = {
  presign: (payload) => api.post('/media/uploads', payload).then((r) => r.data),
  upload: (uploadUrl, file, config) => api.put(uploadUrl, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' }, ...config }).then((r) => r.data),
  complete: (uploadId, payload) => api.post(`/media/uploads/${uploadId}/complete`, payload).then((r) => r.data),
  abort: (uploadId) => api.delete(`/media/uploads/${uploadId}`).then((r) => r.data),
  get: (mediaId) => api.get(`/media/${mediaId}`).then((r) => r.data),
  update: (mediaId, payload) => api.patch(`/media/${mediaId}`, payload).then((r) => r.data),
  remove: (mediaId) => api.delete(`/media/${mediaId}`).then((r) => r.data),
};

export const exportJobsApi = {
  create: (payload) => {
    const key = payload.idempotencyKey ?? `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return api.post('/exports', payload, withIdempotency(key)).then((r) => r.data);
  },
  list: () => api.get('/jobs').then((r) => r.data),
  get: (id) => api.get(`/jobs/${id}`).then((r) => r.data),
};

export const savedViewsApi = {
  list: (tableId) => api.get('/saved-views', { tableId }).then((r) => r.data),
  create: (payload) => api.post('/saved-views', payload).then((r) => r.data),
  remove: (id) => api.delete(`/saved-views/${id}`).then((r) => r.data),
};
