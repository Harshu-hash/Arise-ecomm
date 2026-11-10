import { Worker } from 'bullmq';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { bullmqEnabled, createBullConnection, disconnectRedis } from '../config/redis.js';
import { closeMailer } from '../infrastructure/external/notification/mailer.js';
import { dispatchEvent } from '../infrastructure/events/handlerRegistry.js';
import { DOMAIN_EVENTS_QUEUE } from '../infrastructure/queue/domainEvents.queue.js';
import { MAINTENANCE_QUEUE } from '../infrastructure/queue/maintenance.queue.js';
import { NOTIFICATIONS_QUEUE, emailJobProcessor } from '../infrastructure/queue/notification.queue.js';
import { WEBHOOKS_QUEUE, closeWebhookQueue, webhookJobProcessor } from '../infrastructure/queue/webhook.queue.js';
import { maintenanceJobProcessor } from '../workers/maintenance.processor.js';

const workers = [];
let connection;

async function start() {
  if (!bullmqEnabled) {
    logger.warn('BullMQ/Redis disabled (BULLMQ_ENABLED=false or REDIS_ENABLED=false); worker has nothing to run');
    process.exit(0);
  }

  await connectDatabase();
  connection = createBullConnection();

  workers.push(
    new Worker(
      DOMAIN_EVENTS_QUEUE,
      async (job) => {
        const count = await dispatchEvent(job.data);
        logger.info(
          { eventId: job.data.eventId, eventType: job.data.eventType, handlerCount: count },
          'Domain event processed',
        );
      },
      { connection, concurrency: env.WORKER_CONCURRENCY },
    ),
    new Worker(NOTIFICATIONS_QUEUE, emailJobProcessor, {
      connection,
      concurrency: Math.min(env.WORKER_CONCURRENCY, 10),
      limiter: { max: 20, duration: 1_000 }, // stay under SMTP provider send rates
    }),
    new Worker(WEBHOOKS_QUEUE, webhookJobProcessor, { connection, concurrency: env.WORKER_CONCURRENCY }),
    new Worker(MAINTENANCE_QUEUE, maintenanceJobProcessor, { connection, concurrency: 1 }),
  );

  for (const worker of workers) {
    worker.on('failed', (job, error) => {
      logger.error({ err: error, queue: worker.name, jobId: job?.id, jobName: job?.name }, 'Job failed');
    });
  }
  logger.info('Workers started');
}

async function stop(signal) {
  logger.info({ signal }, 'Stopping worker process');
  await Promise.allSettled(workers.map((worker) => worker.close()));
  if (connection) await connection.quit();
  await Promise.allSettled([closeWebhookQueue(), closeMailer()]);
  await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stop(signal).then(() => process.exit(0)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'Worker process failed');
  process.exit(1);
});
