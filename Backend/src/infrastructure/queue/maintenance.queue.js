import { Queue } from 'bullmq';
import { createBullConnection } from '../../config/redis.js';

export const MAINTENANCE_QUEUE = 'maintenance';
export const MAINTENANCE_JOBS = Object.freeze({
  WEBHOOK_SWEEP: 'webhooks.sweep',
  OUTBOX_CLEANUP: 'outbox.cleanup',
  UPLOAD_TMP_CLEANUP: 'uploads.tmp-cleanup',
});

export function createMaintenanceQueue() {
  const connection = createBullConnection();
  const queue = new Queue(MAINTENANCE_QUEUE, {
    connection,
    defaultJobOptions: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } },
  });
  return { queue, connection };
}

// Idempotent: safe to run on every scheduler start (upsert by scheduler id). Run ONE scheduler replica.
export async function registerMaintenanceSchedules(queue) {
  await queue.upsertJobScheduler('webhooks-sweep', { every: 60_000 }, { name: MAINTENANCE_JOBS.WEBHOOK_SWEEP });
  await queue.upsertJobScheduler('outbox-cleanup', { pattern: '0 3 * * *' }, { name: MAINTENANCE_JOBS.OUTBOX_CLEANUP });
  await queue.upsertJobScheduler('uploads-tmp-cleanup', { every: 60 * 60_000 }, { name: MAINTENANCE_JOBS.UPLOAD_TMP_CLEANUP });
}
