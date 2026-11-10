import { timingSafeEqual } from 'node:crypto';
import { Queue } from 'bullmq';
import mongoose from 'mongoose';
import { Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { env } from '../../config/env.js';
import { bullmqEnabled, createBullConnection } from '../../config/redis.js';
import { OutboxEvent } from '../events/outbox.model.js';
import { DOMAIN_EVENTS_QUEUE } from '../queue/domainEvents.queue.js';
import { MAINTENANCE_QUEUE } from '../queue/maintenance.queue.js';
import { NOTIFICATIONS_QUEUE } from '../queue/notification.queue.js';
import { WEBHOOKS_QUEUE } from '../queue/webhook.queue.js';
import { socketConnectionCount } from '../realtime/socket.js';
import { RECEIPT_STATUS, WebhookReceipt } from '../webhooks/webhookReceipt.model.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';

export const registry = new Registry();
registry.setDefaultLabels({ service: env.SERVICE_NAME });
collectDefaultMetrics({ register: registry });

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency by route template and status',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// Route TEMPLATE (never the raw URL) keeps label cardinality bounded.
export function httpMetrics(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}

let queues;
let queueConnection;
function getQueues() {
  if (!queues) {
    queueConnection = createBullConnection();
    queues = [DOMAIN_EVENTS_QUEUE, NOTIFICATIONS_QUEUE, WEBHOOKS_QUEUE, MAINTENANCE_QUEUE].map(
      (name) => new Queue(name, { connection: queueConnection }),
    );
  }
  return queues;
}

const dbReady = () => mongoose.connection.readyState === 1;

new Gauge({
  name: 'queue_jobs',
  help: 'BullMQ jobs by queue and state (depth, retries, failures)',
  labelNames: ['queue', 'state'],
  registers: [registry],
  async collect() {
    if (!bullmqEnabled) return;
    for (const queue of getQueues()) {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
      for (const [state, value] of Object.entries(counts)) this.set({ queue: queue.name, state }, value);
    }
  },
});

new Gauge({
  name: 'outbox_events',
  help: 'Outbox events pending / failed',
  labelNames: ['status'],
  registers: [registry],
  async collect() {
    if (!dbReady()) return;
    for (const status of ['PENDING', 'FAILED']) this.set({ status }, await OutboxEvent.countDocuments({ status }));
  },
});

new Gauge({
  name: 'outbox_oldest_pending_age_seconds',
  help: 'Age of the oldest pending outbox event (alert when it grows)',
  registers: [registry],
  async collect() {
    if (!dbReady()) return;
    const oldest = await OutboxEvent.findOne({ status: 'PENDING' }, 'createdAt').sort({ createdAt: 1 }).lean();
    this.set(oldest ? (Date.now() - oldest.createdAt.getTime()) / 1000 : 0);
  },
});

new Gauge({
  name: 'webhook_receipts',
  help: 'Webhook receipts not yet processed, by status',
  labelNames: ['status'],
  registers: [registry],
  async collect() {
    if (!dbReady()) return;
    for (const status of [RECEIPT_STATUS.RECEIVED, RECEIPT_STATUS.FAILED, RECEIPT_STATUS.UNHANDLED]) {
      this.set({ status }, await WebhookReceipt.countDocuments({ status }));
    }
  },
});

new Gauge({
  name: 'socket_connections',
  help: 'Connected Socket.IO clients on this replica',
  registers: [registry],
  collect() {
    this.set(socketConnectionCount());
  },
});

// Scrape endpoint: bearer METRICS_TOKEN. With no token configured the endpoint does not exist (404).
export async function metricsHandler(req, res, next) {
  try {
    if (!env.METRICS_TOKEN) return next();
    const given = Buffer.from((req.get('authorization') ?? '').replace(/^Bearer /, ''));
    const expected = Buffer.from(env.METRICS_TOKEN);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedError();
    res.set('Content-Type', registry.contentType);
    return res.end(await registry.metrics());
  } catch (error) {
    return next(error);
  }
}

export async function closeMetrics() {
  if (!queues) return;
  await Promise.allSettled(queues.map((queue) => queue.close()));
  await queueConnection.quit();
  queues = undefined;
}
