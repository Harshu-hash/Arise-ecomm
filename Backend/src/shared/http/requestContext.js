import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage();

export function requestContextMiddleware(req, res, next) {
  const inboundId = req.get('x-request-id');
  const requestId = inboundId && inboundId.length <= 128 ? inboundId : req.id || randomUUID();
  res.setHeader('x-request-id', requestId);

  storage.run(
    {
      requestId,
      actorId: null,
      sellerId: null,
      ip: req.ip,
      userAgent: (req.get('user-agent') ?? '').slice(0, 256),
      startedAt: Date.now(),
    },
    next,
  );
}

export function getRequestContext() {
  return storage.getStore() ?? {};
}

export function enrichRequestContext(values) {
  Object.assign(storage.getStore() ?? {}, values);
}
