import { api } from '@core/api/axiosInstance';

export const bannerAdsApi = {
  requests: (params) => api.get('/banner-ads/requests', params),
  placements: () => api.get('/banner-ads/placements'),
  updatePlacement: (id, payload) => api.patch(`/banner-ads/placements/${id}`, payload),
  decide: (id, payload) => api.post(`/banner-ads/requests/${id}/decide`, payload),
};

export const bannerAdsKeys = {
  requests: (params) => ['admin', 'bannerAds', 'requests', params],
  placements: ['admin', 'bannerAds', 'placements'],
};
