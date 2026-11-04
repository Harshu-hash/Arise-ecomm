import { baseApi } from '@core/api/baseApi';
import { SEARCH_ENDPOINTS } from './search.endpoints';
import { mapSearchProducts, mapSearchSuggestions } from './search.mapper';

export const searchApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getSearchSuggestions: builder.query({
      query: query => ({ url: SEARCH_ENDPOINTS.suggestions, params: { q: query || '' } }),
      transformResponse: mapSearchSuggestions,
      keepUnusedDataFor: 60,
    }),
    searchProducts: builder.query({
      query: args => ({ url: SEARCH_ENDPOINTS.products, params: args }),
      transformResponse: mapSearchProducts,
      providesTags: result => [
        { type: 'Search', id: 'RESULTS' },
        ...(result?.items ?? []).map(product => ({ type: 'Product', id: product.id })),
      ],
      keepUnusedDataFor: 120,
    }),
  }),
});

export const {
  useGetSearchSuggestionsQuery,
  useLazyGetSearchSuggestionsQuery,
  useLazySearchProductsQuery,
  useSearchProductsQuery,
} = searchApi;
