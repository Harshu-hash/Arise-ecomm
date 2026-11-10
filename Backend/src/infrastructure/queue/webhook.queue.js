import { Queue } from 'bullmq';
import { bullmqEnabled, createBullConnection } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { processReceipt } from '../webhooks/webhookProcessor.js';

export const WEBHOOKS_QUEUE = 'webhooks';
export const WEBHOOK_JOB = 'webhook.process';

let queue;
let connection;

function getQueue() {
  queue ??= new Queue(WEBHOOKS_QUEUE, {
    connection: (connection = createBullConnection()),
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: 'exponential', delay: 5_000 },
      // The receipt row is the durable record of state/errors; dropping finished jobs lets the sweeper re-enqueue by id.
      removeOnComplete: true,
      removeOnFail: true,
    },
  });
  return queue;
}

// jobId = receipt id, so enqueueing the same receipt twice (provider retry + sweeper) runs it once.
export async function enqueueWebhookReceipt(receiptId) {
  const id = String(receiptId);
  if (!bullmqEnabled) {
    processReceipt(id).catch((err) => logger.error({ err, receiptId: id }, 'Inline webhook processing failed'));
    return;
  }
  await getQueue().add(WEBHOOK_JOB, { receiptId: id }, { jobId: id });
}

export const webhookJobProcessor = (job) => processReceipt(job.data.receiptId);

export async function closeWebhookQueue() {
  if (!queue) return;
  await queue.close();
  await connection.quit();
  queue = undefined;
  connection = undefined;
}
