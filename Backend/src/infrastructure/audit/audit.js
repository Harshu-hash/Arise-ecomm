import { getRequestContext } from '../../shared/http/requestContext.js';
import { AuditLog } from './audit.model.js';

const SENSITIVE_KEY = /pass(word)?|token|secret|otp|cvv|card|account(number)?|ifsc|pan|aadhaar|authorization|cookie/i;

export function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1)]),
  );
}

// Pass the Mongo `session` when called inside a transaction so the audit fact commits atomically with the change.
export async function recordAudit({ action, subjectType, subjectId, before = null, after = null, reason = null, actor, session }) {
  const context = getRequestContext();
  const [entry] = await AuditLog.create(
    [
      {
        actorId: actor?.userId ?? context.actorId ?? null,
        actorRole: actor?.role ?? null,
        sellerId: actor?.sellerId ?? context.sellerId ?? null,
        action,
        subjectType,
        subjectId: String(subjectId),
        before: redact(before),
        after: redact(after),
        reason,
        requestId: context.requestId ?? null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    ],
    { session },
  );
  return entry;
}
