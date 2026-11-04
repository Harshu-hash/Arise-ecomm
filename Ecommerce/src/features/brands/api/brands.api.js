import { baseApi } from '@core/api/baseApi';
import { BRANDS_ENDPOINTS } from './brands.endpoints';
import { mapBrandsResponse } from './brands.mapper';

export const brandsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getBrands: builder.query({
      query: ({ filter = 'All', cursor } = {}) => ({
        url: BRANDS_ENDPOINTS.list,
        params: { filter, ...(cursor && { cursor }) },
      }),
      transformResponse: mapBrandsResponse,
      providesTags: result => [
        { type: 'Brand', id: 'LIST' },
        ...(result?.items ?? []).map(brand => ({ type: 'Brand', id: brand.id })),
      ],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useGetBrandsQuery, useLazyGetBrandsQuery } = brandsApi;
