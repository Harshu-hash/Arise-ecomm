// Per-process memo with a short TTL. Concurrent callers share one in-flight call; failures are never cached.
// A no-op under test so specs see their own writes immediately.
// shortcut: each API replica keeps its own copy, so a change can take up to `ttlMs` to appear; move to Redis if that matters.
export function ttlMemo(load, ttlMs, keyOf = (arg) => JSON.stringify(arg ?? null)) {
  if (process.env.NODE_ENV === 'test') return Object.assign((arg) => load(arg), { clear() {} });
  const entries = new Map();
  const memo = (arg) => {
    const key = keyOf(arg);
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.promise;
    const promise = load(arg);
    entries.set(key, { promise, expiresAt: Date.now() + ttlMs });
    promise.catch(() => entries.delete(key));
    return promise;
  };
  memo.clear = () => entries.clear();
  return memo;
}
