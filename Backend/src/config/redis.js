import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redisEnabled = env.REDIS_ENABLED && !env.DISABLE_INFRASTRUCTURE;
export const bullmqEnabled = redisEnabled && env.BULLMQ_ENABLED;

// null when REDIS_ENABLED=false: callers must go through redisEnabled / the cache helper.
export const redis = redisEnabled
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
    })
  : null;

redis?.on('error', (error) => logger.error({ err: error }, 'Redis error'));

export async function connectRedis() {
  if (!redis) {
    logger.warn('Redis disabled (REDIS_ENABLED=false): cache, shared rate limits and socket scaling are off');
    return;
  }
  if (redis.status === 'wait') await redis.connect();
  await redis.ping();
  logger.info('Redis connected');
}

export async function disconnectRedis() {
  if (redis && redis.status !== 'end') await redis.quit();
}

export async function redisStatus() {
  if (!redis) return { ready: true, state: 'disabled' };
  try {
    return { ready: (await redis.ping()) === 'PONG', state: redis.status };
  } catch {
    return { ready: false, state: redis.status };
  }
}

// BullMQ needs blocking commands, so it never shares the cache connection.
export function createBullConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
