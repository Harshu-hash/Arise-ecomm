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
  }),
});
export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
