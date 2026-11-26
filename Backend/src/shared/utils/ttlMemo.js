// Per-process memo with a short TTL. Concurrent callers share one in-flight call; failures are never cached.
// A no-op under test so specs see their own writes immediately.
// shortcut: each API replica keeps its own copy, so a change can take up to `ttlMs` to appear; move to Redis if that matters.
// With `staleWhileRevalidate`, an expired value is still returned at once while one background reload replaces it, so a slow
// load never makes a shopper wait after the first fill (a failed reload keeps the old value and retries on the next call).
export function ttlMemo(load, ttlMs, keyOf = (arg) => JSON.stringify(arg ?? null), { staleWhileRevalidate = false } = {}) {
  if (process.env.NODE_ENV === 'test') return Object.assign((arg) => load(arg), { clear() {} });
  const entries = new Map();
  const memo = (arg) => {
    const key = keyOf(arg);
    const hit = entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.promise;
    if (hit?.settled && staleWhileRevalidate) {
      if (!hit.refreshing) {
        hit.refreshing = true;
        // Swap in only if nobody cleared the memo meanwhile (a clear means the data changed; this reload may predate it).
        load(arg).then(
          (value) => { if (entries.get(key) === hit) entries.set(key, { promise: Promise.resolve(value), expiresAt: Date.now() + ttlMs, settled: true }); },
          () => { hit.refreshing = false; },
        );
      }
      return hit.promise;
    }
    const entry = { promise: load(arg), expiresAt: Date.now() + ttlMs, settled: false };
    entries.set(key, entry);
    entry.promise.then(() => { entry.settled = true; }, () => entries.delete(key));
    return entry.promise;
  };
  memo.clear = () => entries.clear();
  return memo;
}
