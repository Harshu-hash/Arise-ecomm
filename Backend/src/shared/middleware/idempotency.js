import { IdempotencyRecord } from '../../infrastructure/idempotency/idempotency.model.js';
import { AppError, ValidationError } from '../errors/AppError.js';
import { sha256 } from '../utils/crypto.js';

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
const STALE_LOCK_MS = 60_000;
const DUPLICATE_KEY = 11000;

// Mount AFTER authenticate + validate, on state-changing commands (checkout, payment, refund, shipment).
// Same key + same body -> original 2xx response replayed. Same key + different body -> 422.
// Only 2xx responses are stored; failures release the key so the client may retry.
export function idempotent() {
  return async (req, res, next) => {
    try {
      const key = req.get('idempotency-key');
      if (!key || !KEY_PATTERN.test(key)) {
        throw new ValidationError('A valid Idempotency-Key header (8-128 chars) is required.', {
          'idempotency-key': ['Missing or malformed'],
        });
      }

      const scope = `${req.auth?.userId ?? req.ip}:${req.method}:${req.originalUrl.split('?')[0]}`;
      const requestHash = sha256(JSON.stringify(req.body ?? {}));
      const filter = { scope, key };

      try {
        await IdempotencyRecord.create({ scope, key, requestHash });
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error;
        const existing = await IdempotencyRecord.findOne(filter).lean();
        if (!existing) return next(); // expired between insert and read: safe to proceed unprotected once

        if (existing.requestHash !== requestHash) {
          throw new AppError({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This Idempotency-Key was already used with a different request.',
            status: 422,
          });
        }
        if (existing.status === 'COMPLETED') {
          res.set('Idempotent-Replayed', 'true');
          return res.status(existing.responseStatus).json(existing.responseBody);
        }
        // A crashed request leaves a stale lock; take it over atomically, otherwise tell the client to retry.
        const taken = await IdempotencyRecord.findOneAndUpdate(
          { ...filter, status: 'IN_PROGRESS', lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } },
          { $set: { lockedAt: new Date() } },
        );
        if (!taken) {
          throw new AppError({
            code: 'IDEMPOTENCY_IN_PROGRESS',
            message: 'A request with this Idempotency-Key is still being processed.',
            status: 409,
            retryable: true,
          });
        }
      }

      const send = res.json.bind(res);
      res.json = (body) => {
        res.json = send;
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        const persist = ok
          ? IdempotencyRecord.updateOne(filter, {
              $set: { status: 'COMPLETED', responseStatus: res.statusCode, responseBody: body },
            })
          : IdempotencyRecord.deleteOne(filter);
        // Persist before replying so a retry after the response always sees the stored outcome.
        persist.catch(() => undefined).then(() => send(body));
        return res;
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
