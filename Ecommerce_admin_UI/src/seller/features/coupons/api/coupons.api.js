import { api } from '@core/api/axiosInstance';

export const COUPON_TYPE_LABELS = {
  PERCENT: 'Percentage off',
  FLAT: 'Flat amount off',
  FREE_DELIVERY: 'Free delivery',
};

// Lists go through useListQuery (GET /coupons with page, q, status, sort); money is integer paise throughout.
export const sellerCouponsApi = {
  create: (payload) => api.post('/coupons', payload),
  pause: (id) => api.post(`/coupons/${id}/pause`, {}),
  resume: (id) => api.post(`/coupons/${id}/resume`, {}),
  end: (id) => api.post(`/coupons/${id}/end`, {}),
};

export const sellerCouponKeys = {
  list: (params) => ['seller', 'coupons', 'list', params],
};
