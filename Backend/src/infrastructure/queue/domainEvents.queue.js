import { Queue } from 'bullmq';
import { createBullConnection } from '../../config/redis.js';

export const DOMAIN_EVENTS_QUEUE = 'domain-events';

export function createDomainEventsQueue() {
  const connection = createBullConnection();
  const queue = new Queue(DOMAIN_EVENTS_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 12,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 50_000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 100_000 },
    },
  });
  return { queue, connection };
}

