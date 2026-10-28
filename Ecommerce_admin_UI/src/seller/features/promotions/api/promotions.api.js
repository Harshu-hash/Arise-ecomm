import { api } from '@core/api/axiosInstance';

export const promotionsApi = {
  flashSales: () => api.get('/promotions/flash-sales').then((r) => r.data),
  nominate: (flashSaleId, payload) => api.post(`/promotions/flash-sales/${flashSaleId}/nominate`, payload).then((r) => r.data),
  nominations: () => api.get('/promotions/nominations').then((r) => r.data),
  deals: () => api.get('/promotions/deals').then((r) => r.data),
  coupons: (params) => api.get('/promotions/coupons', params).then((r) => r.data),
  createCoupon: (payload) => api.post('/promotions/coupons', payload).then((r) => r.data),
  myLiveListings: () => api.get('/listings', { pageSize: 200, status: 'LIVE' }).then((r) => r.data),
};

export const promotionsKeys = {
  flashSales: ['seller', 'promotions', 'flash-sales'],
  nominations: ['seller', 'promotions', 'nominations'],
  deals: ['seller', 'promotions', 'deals'],
  coupons: (p) => ['seller', 'promotions', 'coupons', p],
};
