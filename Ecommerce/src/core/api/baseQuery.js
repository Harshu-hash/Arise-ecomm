import { apiClient } from './axiosInstance';
import { normalizeApiError } from './errors';
import { getNetworkOnline } from '@core/network/networkState';

export const axiosBaseQuery =
  () =>
  async ({ url, method = 'GET', data, params, headers, signal, onUploadProgress }) => {
    if (!getNetworkOnline() && method.toUpperCase() !== 'GET') {
      return {
        error: {
          normalized: true,
          code: 'OFFLINE_MUTATION_BLOCKED',
          message: 'Reconnect before making this change.',
          status: null,
          retryable: true,
        },
      };
    }
    try {
      const response = await apiClient({
        url,
        method,
        data,
        params,
        headers,
        signal,
        onUploadProgress,
      });
      return { data: response.data };
    } catch (error) {
      return { error: normalizeApiError(error) };
    }
  };
