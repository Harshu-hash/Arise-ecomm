import { baseApi } from '@core/api/baseApi';
import { mapDeletionEligibility } from './privacy.mapper';
export const privacyApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getDeletionEligibility: builder.query({
      query: () => ({ url: '/privacy/deletion-eligibility' }),
      transformResponse: mapDeletionEligibility,
      providesTags: [{ type: 'Profile', id: 'DELETION' }],
    }),
    createDeletionRequest: builder.mutation({
      query: data => ({ url: '/privacy/deletion-request', method: 'POST', data }),
      transformResponse: mapDeletionEligibility,
      invalidatesTags: [{ type: 'Profile', id: 'DELETION' }],
    }),
  }),
});
export const {
  useGetDeletionEligibilityQuery,
  useCreateDeletionRequestMutation,
} = privacyApi;
