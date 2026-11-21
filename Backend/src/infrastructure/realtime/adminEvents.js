import { emitTo, rooms } from './socket.js';

const PUSH_DELAY_MS = 300;
const pending = new Set();

/**
 * Express middleware: after a successful write, tell every open admin console that `scope` data changed
 * (event `<scope>:changed`) so its pages refetch. A burst of writes becomes one push per scope.
 * Events are only hints — clients refetch over HTTP and again on reconnect.
 */
export const notifyAdminOnWrite = (scope) => (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 400 || pending.has(scope)) return;
      pending.add(scope);
      setTimeout(() => {
        pending.delete(scope);
        emitTo(rooms.admin, `${scope}:changed`, { at: new Date().toISOString() });
      }, PUSH_DELAY_MS).unref?.();
    });
  }
  next();
};
