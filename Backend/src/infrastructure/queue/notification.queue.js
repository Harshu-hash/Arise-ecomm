import { Queue } from 'bullmq';
import { bullmqEnabled, createBullConnection } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { sendMail } from '../external/notification/mailer.js';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const EMAIL_JOB = 'email.send';

let queue;
let connection;

function getQueue() {
  queue ??= new Queue(NOTIFICATIONS_QUEUE, {
    connection: (connection = createBullConnection()),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
      removeOnFail: { age: 14 * 24 * 60 * 60 },
    },
  });
  return queue;
}

// Request path never waits on SMTP: queued when BullMQ is on, otherwise sent in the background.
// Pass a stable `dedupeKey` (e.g. `order-placed:<orderId>`) so retries never double-send.
export async function enqueueEmail({ to, subject, html, text, dedupeKey }) {
  if (!bullmqEnabled) {
    sendMail({ to, subject, html, text }).catch((err) => logger.error({ err }, 'Inline email failed'));
    return;
  }
  await getQueue().add(EMAIL_JOB, { to, subject, html, text }, dedupeKey ? { jobId: dedupeKey } : undefined);
}

export const emailJobProcessor = (job) => sendMail(job.data);

export async function closeNotificationQueue() {
  if (!queue) return;
  await queue.close();
  await connection.quit();
  queue = undefined;
  connection = undefined;
}
