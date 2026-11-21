import { baseApi } from '@core/api/baseApi';

export const staticPageApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getStaticPage: builder.query({
      query: slug => ({ url: `/pages/${slug}` }),
      transformResponse: response => response.data,
      providesTags: (_result, _error, slug) => [{ type: 'StaticContent', id: slug }],
    }),
  }),
});

export const { useGetStaticPageQuery } = staticPageApi;
