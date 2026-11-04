import { baseApi } from '@core/api/baseApi';
import { SETTINGS_ENDPOINTS } from './settings.endpoints';
import { mapAdPreferences } from './settings.mapper';

export const settingsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getAdPreferences: builder.query({
      query: () => ({ url: SETTINGS_ENDPOINTS.adPreferences }),
      transformResponse: mapAdPreferences,
      providesTags: [{ type: 'Profile', id: 'AD_PREFERENCES' }],
    }),
    updateAdPreferences: builder.mutation({
      query: data => ({ url: SETTINGS_ENDPOINTS.adPreferences, method: 'PATCH', data }),
      transformResponse: mapAdPreferences,
      invalidatesTags: [{ type: 'Profile', id: 'AD_PREFERENCES' }],
    }),
  }),
});
export const { useGetAdPreferencesQuery, useUpdateAdPreferencesMutation } = settingsApi;
