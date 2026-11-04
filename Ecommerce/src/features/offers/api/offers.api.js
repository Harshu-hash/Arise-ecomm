import { baseApi } from '@core/api/baseApi';
import { OFFERS_ENDPOINTS } from './offers.endpoints';
import { mapPromotion, mapPromotionProducts, mapPromotions } from './offers.mapper';

export const offersApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getPromotions: builder.query({
      query: () => ({ url: OFFERS_ENDPOINTS.landing }),
      transformResponse: mapPromotions,
      providesTags: [{ type: 'Coupon', id: 'PROMOTIONS' }],
    }),
    getPromotion: builder.query({
      query: promotionId => ({ url: OFFERS_ENDPOINTS.detail(promotionId) }),
      transformResponse: mapPromotion,
      providesTags: (_result, _error, id) => [{ type: 'Coupon', id }],
    }),
    getPromotionProducts: builder.query({
      query: ({ promotionId, sort = 'popular', cursor } = {}) => ({
        url: OFFERS_ENDPOINTS.products(promotionId),
        params: { sort, cursor },
      }),
      transformResponse: mapPromotionProducts,
    }),
  }),
});

export const { useGetPromotionQuery, useGetPromotionProductsQuery, useGetPromotionsQuery } = offersApi;
