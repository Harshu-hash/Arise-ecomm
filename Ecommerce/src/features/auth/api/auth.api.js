import { baseApi } from '@core/api/baseApi';
import { sessionAuthenticated, sessionCleared } from '../redux/auth.slice';
import { AUTH_ENDPOINTS } from './auth.endpoints';
import {
  mapAuthChallenge,
  mapPasswordResetResult,
  mapPasswordResetVerification,
  mapSession,
} from './auth.mapper';
import { secureSessionStorage } from '@core/storage/secureSessionStorage';
import { unregisterStoredPushToken } from '@features/notifications/services/pushRegistration';

const clearLocalSession = async (_, { dispatch, queryFulfilled }) => {
  try {
    await queryFulfilled;
  } finally {
    try {
      await unregisterStoredPushToken();
      await secureSessionStorage.clear();
    } finally {
      dispatch(sessionCleared());
      dispatch(baseApi.util.resetApiState());
    }
  }
};

const authenticateSession = async (_, { dispatch, queryFulfilled }) => {
  try {
    const { data } = await queryFulfilled;
    dispatch(sessionAuthenticated(data));
    if (data.refreshToken) {
      await secureSessionStorage.saveRefreshToken(data.refreshToken);
    }
  } catch {
    // The component renders query errors; secure-storage failure must not discard
    // an otherwise valid in-memory session.
  }
};

export const authApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    startAuth: builder.mutation({
      query: payload => ({ url: AUTH_ENDPOINTS.start, method: 'POST', data: payload }),
      transformResponse: mapAuthChallenge,
    }),
    verifyOtp: builder.mutation({
      query: payload => ({ url: AUTH_ENDPOINTS.verifyOtp, method: 'POST', data: payload }),
      transformResponse: mapSession,
      invalidatesTags: ['Session', 'Profile'],
      onQueryStarted: authenticateSession,
    }),
    resendOtp: builder.mutation({
      query: payload => ({ url: AUTH_ENDPOINTS.resendOtp, method: 'POST', data: payload }),
      transformResponse: mapAuthChallenge,
    }),
    signup: builder.mutation({
      query: payload => ({ url: AUTH_ENDPOINTS.signup, method: 'POST', data: payload }),
      transformResponse: mapSession,
      invalidatesTags: ['Session', 'Profile'],
      onQueryStarted: authenticateSession,
    }),
    verifyPasswordResetOtp: builder.mutation({
      query: payload => ({
        url: AUTH_ENDPOINTS.verifyPasswordResetOtp,
        method: 'POST',
        data: payload,
      }),
      transformResponse: mapPasswordResetVerification,
    }),
    resetPassword: builder.mutation({
      query: payload => ({ url: AUTH_ENDPOINTS.resetPassword, method: 'POST', data: payload }),
      transformResponse: mapPasswordResetResult,
    }),
    getSession: builder.query({
      query: () => ({ url: AUTH_ENDPOINTS.session }),
      transformResponse: mapSession,
      providesTags: ['Session'],
    }),
    logout: builder.mutation({
      query: () => ({ url: AUTH_ENDPOINTS.logout, method: 'POST' }),
      onQueryStarted: clearLocalSession,
    }),
    logoutAll: builder.mutation({
      query: () => ({ url: AUTH_ENDPOINTS.logoutAll, method: 'POST' }),
      onQueryStarted: clearLocalSession,
    }),
  }),
});

export const {
  useGetSessionQuery,
  useLazyGetSessionQuery,
  useLogoutAllMutation,
  useLogoutMutation,
  useResendOtpMutation,
  useResetPasswordMutation,
  useSignupMutation,
  useStartAuthMutation,
  useVerifyOtpMutation,
  useVerifyPasswordResetOtpMutation,
} = authApi;
