import { hostname } from 'node:os';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { createDomainEventsQueue } from '../queue/domainEvents.queue.js';
import { OutboxEvent } from './outbox.model.js';

const dispatcherId = `${hostname()}:${process.pid}`;
const maxAttempts = 20;

function claimQuery(now) {
  return {
    availableAt: { $lte: now },
    $or: [
      { status: 'PENDING' },
      { status: 'PROCESSING', lockedAt: { $lt: new Date(now.getTime() - env.OUTBOX_LOCK_MS) } },
    ],
  };
}

export function createOutboxDispatcher() {
  const { queue, connection } = createDomainEventsQueue();
  let timer = null;
  let active = false;

  async function claimOne() {
    const now = new Date();
    return OutboxEvent.findOneAndUpdate(
      claimQuery(now),
      {
        $set: { status: 'PROCESSING', lockedAt: now, lockedBy: dispatcherId },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    ).lean();
  }

  async function publish(event) {
    await queue.add(
      event.eventType,
      {
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        sellerId: event.sellerId,
        payload: event.payload,
        metadata: event.metadata,
      },
      { jobId: event.eventId },
    );

    await OutboxEvent.updateOne(
      { _id: event._id, lockedBy: dispatcherId },
      {
        $set: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
        $unset: { lockedAt: 1, lockedBy: 1 },
      },
    );
  }

  async function release(event, error) {
    const terminal = event.attempts >= maxAttempts;
    const delayMs = Math.min(2 ** event.attempts * 1_000, 15 * 60_000);
    await OutboxEvent.updateOne(
      { _id: event._id, lockedBy: dispatcherId },
      {
        $set: {
          status: terminal ? 'FAILED' : 'PENDING',
          availableAt: new Date(Date.now() + delayMs),
          lastError: String(error?.message ?? error).slice(0, 2_000),
        },
        $unset: { lockedAt: 1, lockedBy: 1 },
      },
    );
  }

  async function tick() {
    if (active) return;
    active = true;
    try {
      for (let count = 0; count < env.OUTBOX_BATCH_SIZE; count += 1) {
        const event = await claimOne();
        if (!event) break;
        try {
          await publish(event);
        } catch (error) {
          logger.error({ err: error, eventId: event.eventId }, 'Outbox publish failed');
          await release(event, error);
        }
      }
    } finally {
      active = false;
    }
  }

  return {
    async start() {
      await tick();
      timer = setInterval(
        () => tick().catch((error) => logger.error({ err: error }, 'Outbox tick failed')),
        env.OUTBOX_POLL_INTERVAL_MS,
      );
      timer.unref();
      logger.info({ dispatcherId }, 'Outbox dispatcher started');
    },
    async close() {
      if (timer) clearInterval(timer);
      while (active) await new Promise((resolve) => setTimeout(resolve, 25));
      await queue.close();
      await connection.quit();
    },
  };
}

