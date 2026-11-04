import { CUSTOMER_API_PREFIX } from '@constants/api';
import { ENV } from './env.config';

const withoutTrailingSlash = url => url.replace(/\/+$/, '');

export const API_CONFIG = Object.freeze({
  baseUrl: `${withoutTrailingSlash(ENV.apiBaseUrl)}${CUSTOMER_API_PREFIX}`,
  timeoutMs: ENV.apiTimeoutMs,
  retry: Object.freeze({ maxAttempts: 2, initialDelayMs: 300 }),
});
