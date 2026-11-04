import { baseApi } from '@core/api/baseApi';
import { QUESTION_ENDPOINTS, REVIEW_ENDPOINTS } from './reviews.endpoints';
import {
  mapAnswerResponse,
  mapQuestionResponse,
  mapQuestions,
  mapReviewEligibility,
  mapReviewResponse,
  mapReviews,
} from './reviews.mapper';

export const reviewsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getMyReviews: builder.query({
      query: ({ cursor, limit = 10 } = {}) => ({
        url: REVIEW_ENDPOINTS.mine,
        params: { cursor, limit },
      }),
      transformResponse: mapReviews,
      providesTags: result => [
        { type: 'Review', id: 'MINE' },
        ...(result?.items || []).map(({ id }) => ({ type: 'Review', id })),
      ],
    }),
    getProductReviews: builder.query({
      query: ({ productId, cursor, limit = 10 }) => ({
        url: REVIEW_ENDPOINTS.product(productId),
        params: { cursor, limit },
      }),
      transformResponse: mapReviews,
      providesTags: (_, __, { productId }) => [{ type: 'Review', id: `PRODUCT-${productId}` }],
    }),
    getReviewEligibility: builder.query({
      query: orderItemId => ({ url: REVIEW_ENDPOINTS.eligibility(orderItemId) }),
      transformResponse: mapReviewEligibility,
      providesTags: (_, __, orderItemId) => [{ type: 'Review', id: `ELIGIBILITY-${orderItemId}` }],
    }),
    createReview: builder.mutation({
      query: data => ({ url: REVIEW_ENDPOINTS.create, method: 'POST', data }),
      transformResponse: mapReviewResponse,
      invalidatesTags: (_, __, data) => [
        { type: 'Review', id: 'MINE' },
        { type: 'Review', id: `PRODUCT-${data.productId}` },
        { type: 'Review', id: `ELIGIBILITY-${data.orderItemId}` },
      ],
    }),
    updateReview: builder.mutation({
      query: ({ reviewId, ...data }) => ({
        url: REVIEW_ENDPOINTS.detail(reviewId),
        method: 'PATCH',
        data,
      }),
      transformResponse: mapReviewResponse,
      invalidatesTags: result => [
        { type: 'Review', id: 'MINE' },
        { type: 'Review', id: result?.id },
        { type: 'Review', id: `PRODUCT-${result?.productId}` },
      ],
    }),
    deleteReview: builder.mutation({
      query: review => ({ url: REVIEW_ENDPOINTS.detail(review.id), method: 'DELETE' }),
      invalidatesTags: (_, __, review) => [
        { type: 'Review', id: 'MINE' },
        { type: 'Review', id: `PRODUCT-${review.productId}` },
        { type: 'Review', id: `ELIGIBILITY-${review.orderItemId}` },
      ],
    }),
    getMyQuestions: builder.query({
      query: ({ cursor, limit = 10 } = {}) => ({
        url: QUESTION_ENDPOINTS.mine,
        params: { cursor, limit },
      }),
      transformResponse: mapQuestions,
      providesTags: [{ type: 'Question', id: 'MINE' }],
    }),
    getProductQuestions: builder.query({
      query: ({ productId, cursor, limit = 10 }) => ({
        url: QUESTION_ENDPOINTS.product(productId),
        params: { cursor, limit },
      }),
      transformResponse: mapQuestions,
      providesTags: (_, __, { productId }) => [{ type: 'Question', id: `PRODUCT-${productId}` }],
    }),
    getQuestion: builder.query({
      query: questionId => ({ url: QUESTION_ENDPOINTS.detail(questionId) }),
      transformResponse: mapQuestionResponse,
      providesTags: (_, __, questionId) => [{ type: 'Question', id: questionId }],
    }),
    createQuestion: builder.mutation({
      query: data => ({ url: QUESTION_ENDPOINTS.create, method: 'POST', data }),
      transformResponse: mapQuestionResponse,
      invalidatesTags: (_, __, { productId }) => [
        { type: 'Question', id: 'MINE' },
        { type: 'Question', id: `PRODUCT-${productId}` },
      ],
    }),
    createAnswer: builder.mutation({
      query: ({ questionId, body }) => ({
        url: QUESTION_ENDPOINTS.answers(questionId),
        method: 'POST',
        data: { body },
      }),
      transformResponse: mapAnswerResponse,
      invalidatesTags: (_, __, { questionId }) => [
        { type: 'Question', id: questionId },
        { type: 'Question', id: 'MINE' },
      ],
    }),
    markAnswerHelpful: builder.mutation({
      query: ({ answerId, helpful }) => ({
        url: QUESTION_ENDPOINTS.helpful(answerId),
        method: helpful ? 'PUT' : 'DELETE',
      }),
      transformResponse: mapAnswerResponse,
      invalidatesTags: (_, __, { questionId }) => [{ type: 'Question', id: questionId }],
    }),
  }),
});
export const {
  useCreateReviewMutation,
  useDeleteReviewMutation,
  useGetMyReviewsQuery,
  useGetProductReviewsQuery,
  useGetReviewEligibilityQuery,
  useUpdateReviewMutation,
  useCreateAnswerMutation,
  useCreateQuestionMutation,
  useGetMyQuestionsQuery,
  useGetProductQuestionsQuery,
  useGetQuestionQuery,
  useMarkAnswerHelpfulMutation,
} = reviewsApi;
