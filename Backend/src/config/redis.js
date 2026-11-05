import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 2,
  retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
});

redis.on('error', (error) => logger.error({ err: error }, 'Redis error'));

export async function connectRedis() {
  if (redis.status === 'wait') await redis.connect();
  await redis.ping();
  logger.info('Redis connected');
}

export async function disconnectRedis() {
  if (redis.status !== 'end') await redis.quit();
}

export async function redisStatus() {
  try {
    return { ready: (await redis.ping()) === 'PONG', state: redis.status };
  } catch {
    return { ready: false, state: redis.status };
  }
}

export function createBullConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

