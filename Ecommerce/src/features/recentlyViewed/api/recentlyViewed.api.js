import { baseApi } from '@core/api/baseApi';
import { RECENTLY_VIEWED_ENDPOINTS } from './recentlyViewed.endpoints';
import { mapRecentlyViewed } from './recentlyViewed.mapper';

export const recentlyViewedApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getRecentlyViewed: builder.query({
      query: () => ({ url: RECENTLY_VIEWED_ENDPOINTS.root }),
      transformResponse: mapRecentlyViewed,
      providesTags: [{ type: 'Product', id: 'RECENTLY_VIEWED' }],
    }),
    clearRecentlyViewed: builder.mutation({
      query: () => ({ url: RECENTLY_VIEWED_ENDPOINTS.root, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Product', id: 'RECENTLY_VIEWED' }],
    }),
  }),
});
export const { useClearRecentlyViewedMutation, useGetRecentlyViewedQuery } = recentlyViewedApi;
