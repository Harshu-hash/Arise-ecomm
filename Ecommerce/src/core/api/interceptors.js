import { API_ERROR_CODES, API_HEADERS, HTTP_STATUS } from '@constants/api';
import { normalizeApiError } from './errors';
import { apiClient, refreshClient } from './axiosInstance';

const RADIX = 36;
const REQUEST_ID_RANDOM_LENGTH = 10;
const createRequestId = () =>
  `req_${Date.now().toString(RADIX)}_${Math.random()
    .toString(RADIX)
    .slice(2, REQUEST_ID_RANDOM_LENGTH)}`;
let ejectCurrentInterceptors = null;

export const configureApiInterceptors = ({
  getAccessToken,
  getRefreshToken,
  onTokensRefreshed,
  onSessionExpired,
}) => {
  if (ejectCurrentInterceptors) {
    ejectCurrentInterceptors();
  }
  let refreshPromise = null;

  const requestInterceptor = apiClient.interceptors.request.use(config => {
    const token = getAccessToken();
    config.headers[API_HEADERS.requestId] = createRequestId();
    if (token) {
      config.headers[API_HEADERS.authorization] = `Bearer ${token}`;
    }
    return config;
  });

  const responseInterceptor = apiClient.interceptors.response.use(
    response => response,
    async error => {
      const request = error.config ?? {};
      const refreshToken = getRefreshToken();
      const isUnauthorized = error.response?.status === HTTP_STATUS.unauthorized;
      const isAuthRequest = String(request.url ?? '').startsWith('/auth/');

      if (isUnauthorized && !request.__retried && !isAuthRequest && refreshToken) {
        request.__retried = true;
        try {
          refreshPromise =
            refreshPromise ??
            refreshClient
              .post('/auth/refresh', { refreshToken })
              .then(response => response.data?.data ?? response.data)
              .finally(() => {
                refreshPromise = null;
              });
          const session = await refreshPromise;
          if (!session?.accessToken) {
            throw new Error('Refresh response did not include an access token');
          }
          onTokensRefreshed(session);
          request.headers[API_HEADERS.authorization] = `Bearer ${session.accessToken}`;
          return apiClient(request);
        } catch {
          onSessionExpired();
          return Promise.reject({
            normalized: true,
            code: API_ERROR_CODES.sessionExpired,
            message: 'Your session has expired. Please sign in again.',
            status: HTTP_STATUS.unauthorized,
            retryable: false,
          });
        }
      }

      if (isUnauthorized && !isAuthRequest) {
        onSessionExpired();
      }
      return Promise.reject(normalizeApiError(error));
    },
  );

  ejectCurrentInterceptors = () => {
    apiClient.interceptors.request.eject(requestInterceptor);
    apiClient.interceptors.response.eject(responseInterceptor);
    ejectCurrentInterceptors = null;
  };
  return ejectCurrentInterceptors;
};

export const withIdempotencyKey = (key, config = {}) => ({
  ...config,
  headers: { ...config.headers, [API_HEADERS.idempotencyKey]: key },
});
