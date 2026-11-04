import { baseApi } from '@core/api/baseApi';
import {
  mapDeviceRegistration,
  mapNotification,
  mapNotificationPreferences,
  mapNotifications,
} from './notifications.mapper';
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getNotifications: builder.query({
      query: ({ cursor, limit = 20 } = {}) => ({
        url: '/notifications',
        params: { cursor, limit },
      }),
      transformResponse: mapNotifications,
      providesTags: result => [
        { type: 'Notification', id: 'LIST' },
        ...(result?.items || []).map(({ id }) => ({ type: 'Notification', id })),
      ],
    }),
    markNotificationRead: builder.mutation({
      query: id => ({ url: `/notifications/${encodeURIComponent(id)}/read`, method: 'PUT' }),
      transformResponse: mapNotification,
      invalidatesTags: (_, __, id) => [
        { type: 'Notification', id },
        { type: 'Notification', id: 'LIST' },
      ],
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PUT' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
    getNotificationPreferences: builder.query({
      query: () => ({ url: '/notifications/preferences' }),
      transformResponse: mapNotificationPreferences,
      providesTags: [{ type: 'Notification', id: 'PREFERENCES' }],
    }),
    updateNotificationPreferences: builder.mutation({
      query: data => ({ url: '/notifications/preferences', method: 'PATCH', data }),
      transformResponse: mapNotificationPreferences,
      invalidatesTags: [{ type: 'Notification', id: 'PREFERENCES' }],
    }),
    registerPushToken: builder.mutation({
      query: data => ({ url: '/devices/push-tokens', method: 'POST', data }),
      transformResponse: mapDeviceRegistration,
    }),
    unregisterPushToken: builder.mutation({
      query: deviceId => ({
        url: `/devices/push-tokens/${encodeURIComponent(deviceId)}`,
        method: 'DELETE',
      }),
      transformResponse: mapDeviceRegistration,
    }),
  }),
});
export const {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useRegisterPushTokenMutation,
  useUnregisterPushTokenMutation,
} = notificationsApi;
