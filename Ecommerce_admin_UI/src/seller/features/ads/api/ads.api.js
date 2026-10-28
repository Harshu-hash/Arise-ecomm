import { api } from '@core/api/axiosInstance';

export const adsApi = {
  detail: (id) => api.get(`/ads/campaigns/${id}`).then((r) => r.data),
  create: (payload) => api.post('/ads/campaigns', payload).then((r) => r.data),
  updateBudget: (id, payload) => api.patch(`/ads/campaigns/${id}`, payload).then((r) => r.data),
  submit: (id) => api.post(`/ads/campaigns/${id}/submit`, {}).then((r) => r.data),
  pause: (id) => api.post(`/ads/campaigns/${id}/pause`, {}).then((r) => r.data),
  resume: (id) => api.post(`/ads/campaigns/${id}/resume`, {}).then((r) => r.data),
  end: (id) => api.post(`/ads/campaigns/${id}/end`, {}).then((r) => r.data),
  wallet: () => api.get('/ads/wallet').then((r) => r.data),
  recharge: (amount) => api.post('/ads/wallet/recharge', { amount }).then((r) => r.data),
  // Seller's own live listings, as the product source for a campaign.
  myLiveListings: () => api.get('/listings', { pageSize: 200, status: 'LIVE' }).then((r) => r.data),
};

export const adsKeys = {
  list: (p) => ['seller', 'ads', 'campaigns', p],
  detail: (id) => ['seller', 'ads', 'campaign', id],
  wallet: ['seller', 'ads', 'wallet'],
};
