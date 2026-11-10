import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = (fallback = 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((value) => value === 'true');

const optionalString = z.string().trim().min(1).optional();
const secret = z.string().min(32, 'must be at least 32 characters');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SERVICE_NAME: z.string().min(1).default('arise-commerce-backend'),
  PUBLIC_ORIGIN: z.url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),

  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/arise?replicaSet=rs0'),

  // Realtime & queue infrastructure
  REDIS_ENABLED: booleanFromString('true'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  BULLMQ_ENABLED: booleanFromString('true'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(200).default(20),

  // Rate limiting (always keyed per client IP)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Auth & data protection
  JWT_ACCESS_SECRET: secret.optional(),
  JWT_REFRESH_SECRET: secret.optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().default('arise-commerce'),
  JWT_AUDIENCE: z.string().default('arise-clients'),
  // 32 random bytes, base64 — AES-256-GCM key for sensitive fields at rest.
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 bytes, base64 encoded')
    .optional(),

  // SMTP email
  EMAIL_HOST: optionalString,
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_USER: optionalString,
  EMAIL_PASS: optionalString,
  EMAIL_FROM: z.string().default('Arise <no-reply@arise.local>'),

  // Razorpay
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  // File uploads on local disk (dev: ./uploads, production: /var/www/uploads)
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024), // images & PDFs
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),

  // Admin hardening & operations
  ADMIN_IP_ALLOWLIST: z.string().default(''), // comma-separated IPs/CIDRs; empty = no restriction
  METRICS_TOKEN: secret.optional(), // bearer token required to scrape /metrics
  SOCKET_CONNECT_LIMIT: z.coerce.number().int().positive().default(60), // socket connections per IP per minute

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(100),
  OUTBOX_LOCK_MS: z.coerce.number().int().positive().default(30_000),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(15_000),
  DISABLE_INFRASTRUCTURE: booleanFromString(),
});

// `KEY=` in .env means "not set" — drop empty values so optional keys and defaults behave.
const source = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const result = schema.safeParse(source);

if (!result.success) {
  const message = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

const raw = result.data;
const isProduction = raw.NODE_ENV === 'production';

// Fail fast at boot rather than on the first real request in production.
if (isProduction || raw.NODE_ENV === 'staging') {
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'DATA_ENCRYPTION_KEY',
    'EMAIL_HOST',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'METRICS_TOKEN',
    'UPLOAD_DIR',
  ];
  const missing = required.filter((key) => !raw[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (raw.JWT_ACCESS_SECRET === raw.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
}

export const env = Object.freeze({
  ...raw,
  isProduction,
  corsOrigins: raw.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
  adminIpAllowlist: raw.ADMIN_IP_ALLOWLIST.split(',').map((value) => value.trim()).filter(Boolean),
});
