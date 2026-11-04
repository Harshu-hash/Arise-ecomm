import { baseApi } from '@core/api/baseApi';
import { PRODUCT_ENDPOINTS } from './product.endpoints';
import { mapProductDetail } from './product.mapper';

export const productApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getProduct: builder.query({
      query: productId => ({ url: PRODUCT_ENDPOINTS.detail(productId) }),
      transformResponse: mapProductDetail,
      providesTags: (_, __, productId) => [{ type: 'Product', id: productId }],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useGetProductQuery, useLazyGetProductQuery } = productApi;
