import { emitTo, rooms } from './socket.js';

// "Something customers can see just changed": drop the short-lived read caches at once and tell every connected
// customer app to refetch. A burst of writes (e.g. approving 50 entries) becomes one push.
// shortcut: caches are cleared in this API process only; with several replicas the others age out within their TTL.
const listeners = new Set();
const PUSH_DELAY_MS = 300;
let pending = null;

export const onCatalogChange = (clearCache) => listeners.add(clearCache);

export function catalogChanged() {
  for (const clearCache of listeners) clearCache();
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    emitTo(rooms.public, 'catalog:changed', { at: new Date().toISOString() });
  }, PUSH_DELAY_MS);
  pending.unref?.();
}

/** Express middleware: after any successful write under the mounted path, announce a catalog change. */
export function notifyCatalogOnWrite(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => {
      if (res.statusCode < 400) catalogChanged();
    });
  }
  next();
}
