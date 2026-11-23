import { Queue } from 'bullmq';
import { createBullConnection } from '../../config/redis.js';

export const MAINTENANCE_QUEUE = 'maintenance';
export const MAINTENANCE_JOBS = Object.freeze({
  WEBHOOK_SWEEP: 'webhooks.sweep',
  OUTBOX_CLEANUP: 'outbox.cleanup',
  UPLOAD_TMP_CLEANUP: 'uploads.tmp-cleanup',
  ACCOUNT_DELETION: 'customers.account-deletion',
  STOCK_RESERVATION_EXPIRY: 'stock.reservations-expire',
  RETURN_DECISION_DEADLINE: 'returns.decision-deadline',
  WALLET_RELEASE: 'settlements.release',
  RATING_REBUILD: 'reviews.rebuild-ratings',
  REVIEW_REMINDERS: 'reviews.reminders',
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
  await queue.upsertJobScheduler('customer-account-deletion', { every: 15 * 60_000 }, { name: MAINTENANCE_JOBS.ACCOUNT_DELETION });
  await queue.upsertJobScheduler('stock-reservation-expiry', { every: 60_000 }, { name: MAINTENANCE_JOBS.STOCK_RESERVATION_EXPIRY });
  await queue.upsertJobScheduler('return-decision-deadline', { every: 15 * 60_000 }, { name: MAINTENANCE_JOBS.RETURN_DECISION_DEADLINE });
  await queue.upsertJobScheduler('rating-rebuild', { pattern: '30 3 * * *' }, { name: MAINTENANCE_JOBS.RATING_REBUILD });
  await queue.upsertJobScheduler('review-reminders', { every: 60 * 60_000 }, { name: MAINTENANCE_JOBS.REVIEW_REMINDERS });
  await queue.upsertJobScheduler('wallet-release', { every: 15 * 60_000 }, { name: MAINTENANCE_JOBS.WALLET_RELEASE });
}
