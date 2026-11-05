import pino from 'pino';
import { env } from './env.js';

const transport =
  env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, singleLine: true, translateTime: 'SYS:standard' },
      }
    : undefined;

export const logger = pino({
  name: env.SERVICE_NAME,
  level: env.LOG_LEVEL,
  transport,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      '*.password',
      '*.refreshToken',
      '*.accessToken',
      '*.otp',
      '*.cardNumber',
      '*.cvv',
    ],
    censor: '[REDACTED]',
  },
  base: { service: env.SERVICE_NAME, environment: env.NODE_ENV },
});

