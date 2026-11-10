import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../config/logger.js';
import { OutboxEvent } from '../infrastructure/events/outbox.model.js';
import { MAINTENANCE_JOBS } from '../infrastructure/queue/maintenance.queue.js';
import { TMP_DIR } from '../infrastructure/storage/local.storage.js';
import { enqueueWebhookReceipt } from '../infrastructure/queue/webhook.queue.js';
import { RECEIPT_STATUS, WebhookReceipt } from '../infrastructure/webhooks/webhookReceipt.model.js';

const STALE_RECEIPT_MS = 2 * 60_000;
const MAX_RECEIPT_ATTEMPTS = 24; // stop re-driving poison events; they stay FAILED for alerting/manual replay
const OUTBOX_RETENTION_MS = 14 * 24 * 60 * 60_000;

// Reconciliation: receipts stuck unprocessed (crash between save and enqueue, exhausted retries) are re-driven.
async function sweepWebhooks() {
  const stale = await WebhookReceipt.find(
    {
      status: { $in: [RECEIPT_STATUS.RECEIVED, RECEIPT_STATUS.FAILED] },
      attempts: { $lt: MAX_RECEIPT_ATTEMPTS },
      createdAt: { $lt: new Date(Date.now() - STALE_RECEIPT_MS) },
    },
    '_id',
  )
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();
  for (const { _id } of stale) await enqueueWebhookReceipt(_id);
  if (stale.length) logger.warn({ count: stale.length }, 'Re-drove stale webhook receipts');
}

async function cleanOutbox() {
  const { deletedCount } = await OutboxEvent.deleteMany({
    status: 'PUBLISHED',
    publishedAt: { $lt: new Date(Date.now() - OUTBOX_RETENTION_MS) },
  });
  logger.info({ deletedCount }, 'Outbox cleanup done');
}

// Aborted/failed uploads can leave files in uploads/tmp; anything older than an hour is garbage.
async function cleanUploadTmp() {
  const names = await readdir(TMP_DIR).catch(() => []);
  let removed = 0;
  for (const name of names) {
    const file = path.join(TMP_DIR, name);
    const info = await stat(file).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 60 * 60_000) {
      await rm(file, { force: true });
      removed += 1;
    }
  }
  if (removed) logger.info({ removed }, 'Removed stale upload temp files');
}

export async function maintenanceJobProcessor(job) {
  if (job.name === MAINTENANCE_JOBS.WEBHOOK_SWEEP) return sweepWebhooks();
  if (job.name === MAINTENANCE_JOBS.OUTBOX_CLEANUP) return cleanOutbox();
  if (job.name === MAINTENANCE_JOBS.UPLOAD_TMP_CLEANUP) return cleanUploadTmp();
  throw new Error(`Unknown maintenance job ${job.name}`);
}
