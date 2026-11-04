import { baseApi } from '@core/api/baseApi';
import {
  mapHelpArticle,
  mapHelpCategories,
  mapHelpCategory,
  mapHelpSearch,
  mapSubjects,
  mapTicketResponse,
  mapTickets,
  mapSupportChannels,
} from './support.mapper';
export const supportApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getSupportChannels: builder.query({
      query: () => ({ url: '/support/channels' }),
      transformResponse: mapSupportChannels,
      providesTags: [{ type: 'StaticContent', id: 'SUPPORT-CHANNELS' }],
    }),
    getTicketSubjects: builder.query({
      query: () => ({ url: '/support/subjects' }),
      transformResponse: mapSubjects,
      providesTags: [{ type: 'Ticket', id: 'SUBJECTS' }],
    }),
    getTickets: builder.query({
      query: ({ cursor, limit = 20 } = {}) => ({
        url: '/support/tickets',
        params: { cursor, limit },
      }),
      transformResponse: mapTickets,
      providesTags: result => [
        { type: 'Ticket', id: 'LIST' },
        ...(result?.items || []).map(({ id }) => ({ type: 'Ticket', id })),
      ],
    }),
    getTicket: builder.query({
      query: id => ({ url: `/support/tickets/${encodeURIComponent(id)}` }),
      transformResponse: mapTicketResponse,
      providesTags: (_, __, id) => [{ type: 'Ticket', id }],
    }),
    createTicket: builder.mutation({
      query: data => ({ url: '/support/tickets', method: 'POST', data }),
      transformResponse: mapTicketResponse,
      invalidatesTags: [{ type: 'Ticket', id: 'LIST' }],
    }),
    replyToTicket: builder.mutation({
      query: ({ ticketId, ...data }) => ({
        url: `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
        method: 'POST',
        data,
      }),
      transformResponse: mapTicketResponse,
      invalidatesTags: (_, __, { ticketId }) => [
        { type: 'Ticket', id: ticketId },
        { type: 'Ticket', id: 'LIST' },
      ],
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
  useGetTicketSubjectsQuery,
  useGetTicketsQuery,
  useGetTicketQuery,
  useCreateTicketMutation,
  useReplyToTicketMutation,
  useGetHelpCategoriesQuery,
  useGetHelpCategoryQuery,
  useGetHelpArticleQuery,
  useLazySearchHelpQuery,
  useSubmitArticleFeedbackMutation,
} = supportApi;
