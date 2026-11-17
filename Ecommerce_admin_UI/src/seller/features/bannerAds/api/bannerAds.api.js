import { api, withIdempotency } from '@core/api/axiosInstance';

export const bannerAdsApi = {
  list: (params) => api.get('/banner-ads', params),
  placements: () => api.get('/banner-ads/placements'),
  destinations: () => api.get('/banner-ads/destinations'),
  createAndPay: (payload) => api.post('/banner-ads', payload, withIdempotency(['banner-ad', payload.campaignName, payload.placementId, payload.startsOn, payload.endsOn].join(':'))),
};

export const bannerAdsKeys = {
  list: ['seller', 'bannerAds'],
  placements: ['seller', 'bannerAds', 'placements'],
  destinations: ['seller', 'bannerAds', 'destinations'],
};
