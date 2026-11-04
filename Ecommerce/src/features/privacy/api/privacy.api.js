import { baseApi } from '@core/api/baseApi';
import {
  mapCommunicationPreferences,
  mapDeletionEligibility,
  mapExportRequest,
} from './privacy.mapper';
export const privacyApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getCommunicationPreferences: builder.query({
      query: () => ({ url: '/me/communication-preferences' }),
      transformResponse: mapCommunicationPreferences,
      providesTags: [{ type: 'Profile', id: 'COMMUNICATION' }],
    }),
    updateCommunicationPreferences: builder.mutation({
      query: data => ({ url: '/me/communication-preferences', method: 'PATCH', data }),
      transformResponse: mapCommunicationPreferences,
      invalidatesTags: [{ type: 'Profile', id: 'COMMUNICATION' }],
    }),
    getExportRequest: builder.query({
      query: () => ({ url: '/privacy/export-request' }),
      transformResponse: mapExportRequest,
      providesTags: [{ type: 'Profile', id: 'EXPORT' }],
    }),
    createExportRequest: builder.mutation({
      query: () => ({ url: '/privacy/export-request', method: 'POST' }),
      transformResponse: mapExportRequest,
      invalidatesTags: [{ type: 'Profile', id: 'EXPORT' }],
    }),
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
  useGetCommunicationPreferencesQuery,
  useUpdateCommunicationPreferencesMutation,
  useGetExportRequestQuery,
  useCreateExportRequestMutation,
  useGetDeletionEligibilityQuery,
  useCreateDeletionRequestMutation,
} = privacyApi;
