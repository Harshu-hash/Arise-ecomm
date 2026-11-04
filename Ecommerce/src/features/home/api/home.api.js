import { baseApi } from '@core/api/baseApi';
import { HOME_ENDPOINTS } from './home.endpoints';
import { mapAppConfigResponse, mapHomeResponse } from './home.mapper';

export const homeApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getHome: builder.query({
      query: () => ({ url: HOME_ENDPOINTS.feed }),
      transformResponse: mapHomeResponse,
      providesTags: [{ type: 'Home', id: 'FEED' }],
      keepUnusedDataFor: 120,
    }),
    getAppConfig: builder.query({
      query: () => ({ url: HOME_ENDPOINTS.appConfig }),
      transformResponse: mapAppConfigResponse,
      providesTags: ['FeatureFlag', 'StaticContent'],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const {
  useGetAppConfigQuery,
  useGetHomeQuery,
  useLazyGetAppConfigQuery,
  useLazyGetHomeQuery,
} = homeApi;
