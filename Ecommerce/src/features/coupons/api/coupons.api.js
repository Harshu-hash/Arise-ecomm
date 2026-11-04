import { baseApi } from '@core/api/baseApi';
import { mapCoupons } from './coupons.mapper';

export const couponsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAvailableCoupons: builder.query({
      query: () => ({ url: '/coupons/available' }),
      transformResponse: mapCoupons,
      providesTags: [{ type: 'Coupon', id: 'AVAILABLE' }],
    }),
  }),
});
export const { useGetAvailableCouponsQuery } = couponsApi;
