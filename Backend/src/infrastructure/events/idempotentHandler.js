import { withTransaction } from '../../config/database.js';
import { ProcessedEvent } from './processedEvent.model.js';

function isDuplicateKey(error) {
  return error?.code === 11000;
}

export async function runIdempotentHandler({ event, handlerName, handle }) {
  try {
    const result = await withTransaction(async (session) => {
      await ProcessedEvent.create(
        [
          {
            eventId: event.eventId,
            eventType: event.eventType,
            handlerName,
          },
        ],
        { session },
      );

      return handle(event, session);
    });
    return { processed: true, result };
  } catch (error) {
    if (isDuplicateKey(error)) return { processed: false, duplicate: true };
    throw error;
  }
}

