import { baseApi } from '@core/api/baseApi';
import { PROFILE_ENDPOINTS } from './profile.endpoints';
import { mapProfile } from './profile.mapper';

export const profileApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getProfile: builder.query({
      query: () => ({ url: PROFILE_ENDPOINTS.me }),
      transformResponse: mapProfile,
      providesTags: [{ type: 'Profile', id: 'ME' }],
    }),
    updateProfile: builder.mutation({
      query: data => ({ url: PROFILE_ENDPOINTS.me, method: 'PATCH', data }),
      transformResponse: mapProfile,
      invalidatesTags: [{ type: 'Profile', id: 'ME' }],
    }),
    // Confirms a new email/phone with the code sent to it; only then does it replace the current one.
    verifyContact: builder.mutation({
      query: data => ({ url: PROFILE_ENDPOINTS.verifyContact, method: 'POST', data }),
      transformResponse: mapProfile,
      invalidatesTags: [{ type: 'Profile', id: 'ME' }],
    }),
  }),
});
export const { useGetProfileQuery, useUpdateProfileMutation, useVerifyContactMutation } = profileApi;
