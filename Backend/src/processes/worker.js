import { Worker } from 'bullmq';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { dispatchEvent } from '../infrastructure/events/handlerRegistry.js';
import { DOMAIN_EVENTS_QUEUE } from '../infrastructure/queue/domainEvents.queue.js';
import { createBullConnection } from '../config/redis.js';

let connection;
let worker;

async function start() {
  await connectDatabase();
  connection = createBullConnection();
  worker = new Worker(
    DOMAIN_EVENTS_QUEUE,
    async (job) => {
      const count = await dispatchEvent(job.data);
      logger.info(
        { eventId: job.data.eventId, eventType: job.data.eventType, handlerCount: count },
        'Domain event processed',
      );
    },
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 20) },
  );

  worker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id, eventType: job?.name }, 'Domain event job failed');
  });
  logger.info('Domain event worker started');
}

async function stop(signal) {
  logger.info({ signal }, 'Stopping worker process');
  if (worker) await worker.close();
  if (connection) await connection.quit();
  await disconnectDatabase();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stop(signal).then(() => process.exit(0)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Worker process failed');
  process.exit(1);
});

