import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { RateLimitError } from '../errors/AppError.js';

// Limits are per client IP (req.ip honours TRUST_PROXY; IPv6 is bucketed by subnet).
// The Redis store makes the counter shared across API replicas; without Redis it is per-process memory.
export function createRateLimiter({ name, windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    // A Redis outage must not take the API down: fail open on store errors.
    passOnStoreError: true,
    store: redis
      ? new RedisStore({ prefix: `rl:${name}:`, sendCommand: (...args) => redis.call(...args) })
      : undefined,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });
}

export const globalRateLimiter = () =>
  createRateLimiter({ name: 'global', windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX });

// Stricter bucket for login / OTP / password-reset routes (brute-force protection).
export const authRateLimiter = () =>
  createRateLimiter({ name: 'auth', windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS, limit: env.AUTH_RATE_LIMIT_MAX });
