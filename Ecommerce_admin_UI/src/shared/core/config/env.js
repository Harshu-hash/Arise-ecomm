const raw = import.meta.env ?? {};

export const ENV = {
  mode: raw.VITE_API_MODE === 'live' ? 'live' : 'mock',
  apiBaseUrl: raw.VITE_API_BASE_URL || '/api/admin/v1',
  label: raw.VITE_ENV_LABEL || (raw.VITE_API_MODE === 'live' ? 'LIVE' : 'MOCK'),
  isDev: Boolean(raw.DEV),
};

export const IS_MOCK = ENV.mode === 'mock';

/**
 * Keeps the configured API origin while selecting an audience namespace.
 * For example, an admin base of https://api.example.com/api/admin/v1 becomes
 * https://api.example.com/api/seller/v1 for the seller entry point.
 */
export function apiBaseForAudience(audience) {
  const base = String(ENV.apiBaseUrl).replace(/\/$/, '');
  const audienceSuffix = `/api/${audience}/v1`;

  if (/\/api\/(admin|seller|customer)\/v1$/.test(base)) {
    return base.replace(/\/api\/(admin|seller|customer)\/v1$/, audienceSuffix);
  }

  return `${base}${audienceSuffix}`;
}

/** Dev-only affordances (mock toolbar, component gallery) are gated on this. */
export const SHOW_DEV_TOOLS = IS_MOCK && ENV.isDev;

/** Timezone every date in this panel is rendered in (plan: India only). */
export const APP_TIMEZONE = 'Asia/Kolkata';
export const CURRENCY = 'INR';
