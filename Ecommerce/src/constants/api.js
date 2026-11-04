export const API_VERSION = 'v1';
export const CUSTOMER_API_PREFIX = `/api/customer/${API_VERSION}`;

export const API_HEADERS = Object.freeze({
  authorization: 'Authorization',
  idempotencyKey: 'Idempotency-Key',
  requestId: 'X-Request-Id',
});

export const API_ERROR_CODES = Object.freeze({
  network: 'NETWORK_ERROR',
  timeout: 'REQUEST_TIMEOUT',
  unknown: 'UNKNOWN_ERROR',
  sessionExpired: 'SESSION_EXPIRED',
});

export const HTTP_STATUS = Object.freeze({
  unauthorized: 401,
  tooManyRequests: 429,
});
