import { baseApi } from '@core/api/baseApi';
import { PRODUCT_ENDPOINTS } from './product.endpoints';
import { mapProductDetail, mapRelatedProducts } from './product.mapper';

export const productApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getRelatedProducts: builder.query({
      query: productId => ({ url: PRODUCT_ENDPOINTS.related(productId) }),
      transformResponse: mapRelatedProducts,
      providesTags: (_, __, productId) => [{ type: 'Product', id: `RELATED-${productId}` }],
      keepUnusedDataFor: 300,
    }),
    getProduct: builder.query({
      query: productId => ({ url: PRODUCT_ENDPOINTS.detail(productId) }),
      transformResponse: mapProductDetail,
      providesTags: (_, __, productId) => [{ type: 'Product', id: productId }],
      keepUnusedDataFor: 300,
      // Opening a product while signed in adds it to "Still looking for these?" on Home: refresh that feed.
      async onQueryStarted(_productId, { dispatch, getState, queryFulfilled }) {
        try {
          await queryFulfilled;
          if (getState().auth.accessToken) dispatch(baseApi.util.invalidateTags([{ type: 'Home', id: 'FEED' }]));
        } catch {
          // a failed product load changes nothing on Home
        }
      },
    }),
  }),
});

export const { useGetProductQuery, useGetRelatedProductsQuery, useLazyGetProductQuery } = productApi;
