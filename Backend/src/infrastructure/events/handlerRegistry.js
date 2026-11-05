import { runIdempotentHandler } from './idempotentHandler.js';

const handlers = new Map();

export function registerEventHandler(eventType, handlerName, handler) {
  const entries = handlers.get(eventType) ?? [];
  if (entries.some((entry) => entry.name === handlerName)) {
    throw new Error(`Duplicate handler ${handlerName} for ${eventType}`);
  }
  entries.push({ name: handlerName, handle: handler });
  handlers.set(eventType, entries);
}

export async function dispatchEvent(event) {
  const entries = handlers.get(event.eventType) ?? [];
  if (entries.length === 0) {
    throw new Error(`No handler is registered for event type ${event.eventType}`);
  }
  await Promise.all(
    entries.map((entry) =>
      runIdempotentHandler({ event, handlerName: entry.name, handle: entry.handle }),
    ),
  );
  return entries.length;
}

