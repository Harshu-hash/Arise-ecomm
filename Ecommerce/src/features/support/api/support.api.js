import { baseApi } from '@core/api/baseApi';
import {
  mapHelpArticle,
  mapHelpCategories,
  mapHelpCategory,
  mapHelpSearch,
  mapChat,
  mapChatList,
  mapSupportChannels,
} from './support.mapper';
export const supportApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getSupportChannels: builder.query({
      query: () => ({ url: '/support/channels' }),
      transformResponse: mapSupportChannels,
      providesTags: [{ type: 'StaticContent', id: 'SUPPORT-CHANNELS' }],
    }),
    getChat: builder.query({
      query: () => ({ url: '/support/chat' }),
      transformResponse: mapChat,
      providesTags: [{ type: 'Chat', id: 'CURRENT' }],
    }),
    getChatById: builder.query({
      query: id => ({ url: `/support/chats/${encodeURIComponent(id)}` }),
      transformResponse: mapChat,
      providesTags: (_, __, id) => [{ type: 'Chat', id }],
    }),
    getChatHistory: builder.query({
      query: ({ cursor, limit = 20 } = {}) => ({ url: '/support/chats', params: { cursor, limit } }),
      transformResponse: mapChatList,
      providesTags: [{ type: 'Chat', id: 'LIST' }],
    }),
    markChatRead: builder.mutation({
      query: () => ({ url: '/support/chat/read', method: 'POST' }),
      transformResponse: mapChat,
      invalidatesTags: [{ type: 'Chat', id: 'CURRENT' }],
    }),
    sendChatMessage: builder.mutation({
      query: data => ({ url: '/support/chat/messages', method: 'POST', data }),
      transformResponse: mapChat,
      invalidatesTags: [{ type: 'Chat', id: 'CURRENT' }, { type: 'Chat', id: 'LIST' }],
    }),
    getHelpCategories: builder.query({
      query: () => ({ url: '/help/categories' }),
      transformResponse: mapHelpCategories,
      providesTags: [{ type: 'StaticContent', id: 'HELP-CATEGORIES' }],
    }),
    getHelpCategory: builder.query({
      query: id => ({ url: `/help/categories/${encodeURIComponent(id)}` }),
      transformResponse: mapHelpCategory,
      providesTags: (_, __, id) => [{ type: 'StaticContent', id: `HELP-CATEGORY-${id}` }],
    }),
    getHelpArticle: builder.query({
      query: id => ({ url: `/help/articles/${encodeURIComponent(id)}` }),
      transformResponse: mapHelpArticle,
      providesTags: (_, __, id) => [{ type: 'StaticContent', id: `HELP-ARTICLE-${id}` }],
    }),
    searchHelp: builder.query({
      query: query => ({ url: '/help/search', params: { query } }),
      transformResponse: mapHelpSearch,
    }),
    submitArticleFeedback: builder.mutation({
      query: ({ articleId, helpful }) => ({
        url: `/help/articles/${encodeURIComponent(articleId)}/feedback`,
        method: 'PUT',
        data: { helpful },
      }),
      transformResponse: mapHelpArticle,
      invalidatesTags: (_, __, { articleId }) => [
        { type: 'StaticContent', id: `HELP-ARTICLE-${articleId}` },
      ],
    }),
  }),
});
export const {
  useGetSupportChannelsQuery,
  useGetChatQuery,
  useGetChatByIdQuery,
  useGetChatHistoryQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
  useGetHelpCategoriesQuery,
  useGetHelpCategoryQuery,
  useGetHelpArticleQuery,
  useLazySearchHelpQuery,
  useSubmitArticleFeedbackMutation,
} = supportApi;
