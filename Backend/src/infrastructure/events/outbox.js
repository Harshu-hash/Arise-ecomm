import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/http/requestContext.js';
import { OutboxEvent } from './outbox.model.js';

export function toOutboxEvent({ type, version = 1, aggregateType, aggregateId, sellerId = null, payload }) {
  const context = getRequestContext();
  return {
    eventId: randomUUID(),
    eventType: type,
    eventVersion: version,
    aggregateType,
    aggregateId: String(aggregateId),
    sellerId: sellerId ? String(sellerId) : null,
    payload,
    metadata: {
      requestId: context.requestId ?? null,
      actorId: context.actorId ?? null,
      occurredAt: new Date().toISOString(),
    },
  };
}

export async function appendOutboxEvents(events, session) {
  if (!session) throw new Error('A MongoDB session is required when appending transactional outbox events.');
  if (!events.length) return [];
  return OutboxEvent.insertMany(events, { session, ordered: true });
}

