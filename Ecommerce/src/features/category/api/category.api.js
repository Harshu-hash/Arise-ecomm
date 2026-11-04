import { baseApi } from '@core/api/baseApi';
import { CATEGORY_ENDPOINTS } from './category.endpoints';
import { mapCategoryDetail, mapCategoryTree } from './category.mapper';

export const categoryApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getCategoryTree: builder.query({
      query: () => ({ url: CATEGORY_ENDPOINTS.tree }),
      transformResponse: mapCategoryTree,
      providesTags: result => [
        { type: 'Category', id: 'TREE' },
        ...(result ?? []).map(category => ({ type: 'Category', id: category.id })),
      ],
      keepUnusedDataFor: 300,
    }),
    getCategory: builder.query({
      query: categoryId => ({ url: CATEGORY_ENDPOINTS.detail(categoryId) }),
      transformResponse: mapCategoryDetail,
      providesTags: (_, __, categoryId) => [{ type: 'Category', id: categoryId }],
    }),
  }),
});

export const {
  useGetCategoryQuery,
  useGetCategoryTreeQuery,
  useLazyGetCategoryQuery,
} = categoryApi;
