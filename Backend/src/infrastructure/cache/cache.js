import { redis } from '../../config/redis.js';

// Redis is a cache only (never authoritative). Every call degrades to a miss
// when Redis is disabled or failing, so callers always fall back to MongoDB.
export async function cacheGetOrSet(key, ttlSeconds, load) {
  if (!redis) return load();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch {
    return load();
  }
  const value = await load();
  if (value !== undefined) redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => undefined);
  return value;
}

export async function cacheDelete(...keys) {
  if (!redis || keys.length === 0) return;
  await redis.del(...keys).catch(() => undefined);
}
