const SENSITIVE_KEYS = /authorization|token|password|otp|cvv|card(number)?|address|phone|email/i;

const redact = value => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redact(item)]),
  );
};

const write = (level, message, context) => {
  if (!__DEV__ && level === 'debug') return;
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[method](`[${level.toUpperCase()}] ${message}`, context ? redact(context) : '');
};

export const logger = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
export { redact as redactLogContext };
