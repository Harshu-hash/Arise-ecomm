import { logger } from '@core/logger';

let reporter = null;

export const configureCrashReporting = implementation => {
  reporter = implementation || null;
};

export const reportException = (error, context = {}) => {
  logger.error(error?.message || 'Unhandled application error', context);
  reporter?.captureException?.(error, context);
};
