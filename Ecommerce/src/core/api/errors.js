import axios from 'axios';
import { API_ERROR_CODES } from '@constants/api';

const fallbackMessage = 'Something went wrong. Please try again.';
const SERVER_ERROR_STATUS = 500;

export const normalizeApiError = error => {
  if (error?.normalized) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return {
      normalized: true,
      code: API_ERROR_CODES.unknown,
      message: error?.message || fallbackMessage,
      status: null,
      fieldErrors: null,
      details: null,
      requestId: null,
      retryable: false,
    };
  }

  const body = error.response?.data?.error ?? error.response?.data ?? {};
  const timedOut = error.code === 'ECONNABORTED';
  const networkFailure = !error.response;
  const status = error.response?.status ?? null;

  return {
    normalized: true,
    code: body.code || (timedOut ? API_ERROR_CODES.timeout : API_ERROR_CODES.network),
    message:
      body.message ||
      (networkFailure ? 'Check your internet connection and try again.' : fallbackMessage),
    status,
    fieldErrors: body.fieldErrors ?? null,
    details: body.details ?? null,
    requestId: body.requestId ?? error.response?.headers?.['x-request-id'] ?? null,
    retryable: body.retryable ?? (networkFailure || (status ?? 0) >= SERVER_ERROR_STATUS),
  };
};
