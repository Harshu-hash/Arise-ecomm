import { baseApi } from '@core/api/baseApi';
import { ariseRatingInputSchema, ariseRatingResponseSchema } from './ariseRating.schemas';

export const ariseRatingApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    submitAriseRating: builder.mutation({
      query: input => ({ url: '/arise-ratings', method: 'PUT', data: ariseRatingInputSchema.parse(input) }),
      transformResponse: payload => ariseRatingResponseSchema.parse(payload).data,
      invalidatesTags: ['AriseRating'],
    }),
  }),
});

export const { useSubmitAriseRatingMutation } = ariseRatingApi;
