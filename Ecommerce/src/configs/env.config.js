import Config from 'react-native-config';

const KNOWN_ENVIRONMENTS = new Set(['development', 'test', 'staging', 'production']);
const DEFAULT_TIMEOUT_MS = 30000;

const value = input => (typeof input === 'string' ? input.trim() : '');

const toBoolean = (input, fallback = false) => {
  const normalized = value(input).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return normalized === 'true' || normalized === '1';
};

const toPositiveInteger = (input, fallback) => {
  const parsed = Number.parseInt(value(input), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const appEnvironment = value(Config.APP_ENV) || 'development';

if (!KNOWN_ENVIRONMENTS.has(appEnvironment)) {
  throw new Error(`Unsupported APP_ENV: ${appEnvironment}`);
}

export const ENV = Object.freeze({
  appEnvironment,
  apiBaseUrl: value(Config.API_BASE_URL),
  apiTimeoutMs: toPositiveInteger(Config.API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  socketUrl: value(Config.SOCKET_URL),
  enableApiMocks: toBoolean(Config.ENABLE_API_MOCKS, appEnvironment !== 'production'),
  analyticsEnabled: toBoolean(Config.ANALYTICS_ENABLED, appEnvironment === 'production'),
  sentryDsn: value(Config.SENTRY_DSN),
  paymentProvider: value(Config.PAYMENT_PROVIDER),
  mapsProvider: value(Config.MAPS_PROVIDER),
  isDevelopment: appEnvironment === 'development',
  isProduction: appEnvironment === 'production',
});

export const validateRuntimeEnvironment = () => {
  const errors = [];
  if (!ENV.apiBaseUrl) {
    errors.push('API_BASE_URL is required');
  }
  if (ENV.isProduction && ENV.enableApiMocks) {
    errors.push('ENABLE_API_MOCKS must be false in production');
  }
  if (ENV.isProduction && /example\.com/i.test(ENV.apiBaseUrl)) {
    errors.push('API_BASE_URL must not use an example domain in production');
  }
  if (ENV.isProduction && !ENV.paymentProvider) {
    errors.push('PAYMENT_PROVIDER is required in production');
  }
  if (ENV.isProduction && !value(Config.FIREBASE_PROJECT_ID)) {
    errors.push('FIREBASE_PROJECT_ID is required in production');
  }
  return errors;
};
