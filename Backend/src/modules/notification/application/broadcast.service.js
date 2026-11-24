import { logger } from '../../../config/logger.js';
import { fcm } from '../../../infrastructure/external/notification/fcm.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { notificationChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { countCustomers, getUserSummaries, listActiveSellerIds, listCustomerIds } from '../../identity/public/index.js';
import { Device } from '../infrastructure/persistence/device.model.js';
import { Notification } from '../infrastructure/persistence/notification.model.js';
import { Preference } from '../infrastructure/persistence/preference.model.js';
import { BROADCAST_STATUS, PushBroadcast } from '../infrastructure/persistence/pushBroadcast.model.js';

const BATCH = 500;
const PUSH_CONCURRENCY = 25;
const STUCK_AFTER_MS = 15 * 60_000; // a broadcast still "sending" this long after its last update lost its process; take it over
const HISTORY_LIMIT = 100;

const view = (row) => ({
  id: String(row._id),
  title: row.title,
  message: row.message,
  campaignName: row.campaignName,
  imageUrl: row.imageUrl,
  deepLink: row.deepLink,
  audiences: row.audiences,
  platforms: row.platforms,
  priority: row.priority,
  sound: row.sound,
  collapseKey: row.collapseKey,
  scheduleAt: row.scheduleAt?.toISOString() ?? null,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  createdByName: row.createdByName,
  sentAt: row.sentAt?.toISOString() ?? null,
  inboxCount: row.inboxCount,
  pushSent: row.pushSent,
  pushFailed: row.pushFailed,
  failureReason: row.failureReason,
});

export async function listBroadcasts() {
  return (await PushBroadcast.find().sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean()).map(view);
}

/** Who a broadcast would reach: everyone gets it in their notification list; a phone push needs a registered phone on a chosen platform. */
export async function audienceCounts(platforms) {
  const phones = platforms.map((platform) => platform.toLowerCase());
  const [customers, pushable, sellers] = await Promise.all([
    countCustomers(),
    fcm.configured() ? Device.distinct('userId', { invalidAt: null, platform: { $in: phones } }) : [],
    listActiveSellerIds(),
  ]);
  return { customers, customersWithPush: pushable.length, sellers: sellers.length, pushConfigured: fcm.configured() };
}

export async function createBroadcast(input, actor) {
  const now = new Date();
  const name = (await getUserSummaries([actor.userId])).get(String(actor.userId))?.name ?? null;
  const row = await PushBroadcast.create({ ...input, scheduleAt: input.scheduleAt ?? now, createdBy: String(actor.userId), createdByName: name });
  await recordAudit({ action: 'notification.broadcast_create', subjectType: 'pushBroadcast', subjectId: row._id, after: { title: row.title, audiences: row.audiences, scheduleAt: row.scheduleAt }, actor });
  // "Send now" goes out in the background (a large audience takes a while); a later time waits for the minute job.
  if (row.scheduleAt <= now) setImmediate(() => dispatchBroadcast(row._id).catch((err) => logger.error({ err }, 'Broadcast dispatch failed')));
  return view(row);
}

export async function cancelBroadcast(id, actor) {
  const row = await PushBroadcast.findOneAndUpdate({ _id: id, status: BROADCAST_STATUS.SCHEDULED }, { $set: { status: BROADCAST_STATUS.CANCELLED } }, { new: true }).lean();
  if (!row) {
    if (!(await PushBroadcast.exists({ _id: id }))) throw new NotFoundError('Broadcast not found.');
    throw new ConflictError('BROADCAST_NOT_CANCELLABLE', 'Only a broadcast that has not started yet can be cancelled.');
  }
  await recordAudit({ action: 'notification.broadcast_cancel', subjectType: 'pushBroadcast', subjectId: id, before: { status: 'SCHEDULED' }, after: { status: 'CANCELLED' }, actor });
  return view(row);
}

// One in-app message per recipient, once per broadcast (a re-run after a crash does not repeat it). Returns [{ id, notificationId }] for the new ones.
async function addToInboxes(broadcast, recipientType, recipientIds) {
  const key = `broadcast:${broadcast._id}`;
  const result = await Notification.bulkWrite(recipientIds.map((recipientId) => ({
    updateOne: {
      filter: { recipientType, recipientId, deduplicationKey: key },
      update: { $setOnInsert: { category: 'OFFER', title: broadcast.title, body: broadcast.message, target: { type: 'NONE', entityId: null }, severity: 'info', link: null } },
      upsert: true,
    },
  })), { ordered: false });
  return Object.entries(result.upsertedIds ?? {}).map(([index, notificationId]) => ({ id: recipientIds[Number(index)], notificationId: String(notificationId) }));
}

async function pushTo(broadcast, fresh) {
  if (!fcm.configured() || !fresh.length) return { sent: 0, failed: 0 };
  const ids = fresh.map((entry) => entry.id);
  const [blocked, devices] = await Promise.all([
    Preference.find({ customerId: { $in: ids }, $or: [{ offers: false }, { pushPermission: 'DENIED' }] }, 'customerId').lean(),
    Device.find({ userId: { $in: ids }, invalidAt: null, platform: { $in: broadcast.platforms.map((p) => p.toLowerCase()) } }, 'userId token').lean(),
  ]);
  const skip = new Set(blocked.map((row) => row.customerId));
  const notificationOf = new Map(fresh.map((entry) => [entry.id, entry.notificationId]));
  const ttlSeconds = broadcast.expiresAt ? Math.max(1, Math.floor((broadcast.expiresAt - Date.now()) / 1000)) : undefined;
  const targets = devices.filter((device) => !skip.has(device.userId));
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += PUSH_CONCURRENCY) {
    await Promise.all(targets.slice(i, i + PUSH_CONCURRENCY).map(async (device) => {
      try {
        const result = await fcm.send({
          token: device.token,
          title: broadcast.title,
          body: broadcast.message,
          image: broadcast.imageUrl ?? undefined,
          priority: broadcast.priority === 'HIGH' ? 'high' : 'normal',
          sound: broadcast.sound,
          collapseKey: broadcast.collapseKey ?? undefined,
          ttlSeconds,
          data: { notificationId: notificationOf.get(device.userId), targetType: 'NONE', entityId: '', broadcastId: String(broadcast._id), deepLink: broadcast.deepLink ?? '' },
        });
        if (result.invalidToken) {
          failed += 1;
          await Device.updateOne({ _id: device._id }, { $set: { invalidAt: new Date() } });
        } else sent += 1;
      } catch (err) {
        failed += 1;
        logger.warn({ err }, 'Broadcast push failed');
      }
    }));
  }
  return { sent, failed };
}

async function deliverToCustomers(broadcast) {
  let afterId = null;
  for (;;) {
    const ids = await listCustomerIds({ afterId, limit: BATCH });
    if (!ids.length) return;
    afterId = ids[ids.length - 1];
    const fresh = await addToInboxes(broadcast, 'CUSTOMER', ids);
    fresh.forEach((entry) => notificationChanged('CUSTOMER', entry.id));
    const { sent, failed } = await pushTo(broadcast, fresh);
    await PushBroadcast.updateOne({ _id: broadcast._id }, { $inc: { inboxCount: fresh.length, pushSent: sent, pushFailed: failed } });
  }
}

async function deliverToSellers(broadcast) {
  const ids = await listActiveSellerIds();
  for (let i = 0; i < ids.length; i += BATCH) {
    const fresh = await addToInboxes(broadcast, 'SELLER', ids.slice(i, i + BATCH));
    fresh.forEach((entry) => notificationChanged('SELLER', entry.id));
    await PushBroadcast.updateOne({ _id: broadcast._id }, { $inc: { inboxCount: fresh.length } });
  }
}

const claimable = (now) => ({
  $or: [
    { status: BROADCAST_STATUS.SCHEDULED, scheduleAt: { $lte: now } },
    { status: BROADCAST_STATUS.SENDING, updatedAt: { $lt: new Date(now - STUCK_AFTER_MS) } },
  ],
});

/** Sends one broadcast that is due. Safe to call twice: only one caller wins the claim, and nobody is told twice. */
export async function dispatchBroadcast(id) {
  const now = new Date();
  const claimed = await PushBroadcast.findOneAndUpdate({ _id: id, ...claimable(now) }, { $set: { status: BROADCAST_STATUS.SENDING } }, { new: true }).lean();
  if (!claimed) return null;
  if (claimed.expiresAt && claimed.expiresAt <= now) {
    await PushBroadcast.updateOne({ _id: id }, { $set: { status: BROADCAST_STATUS.EXPIRED } });
    return null;
  }
  try {
    if (claimed.audiences.includes('CUSTOMERS')) await deliverToCustomers(claimed);
    if (claimed.audiences.includes('SELLERS')) await deliverToSellers(claimed);
    await PushBroadcast.updateOne({ _id: id }, { $set: { status: BROADCAST_STATUS.SENT, sentAt: new Date() } });
  } catch (err) {
    logger.error({ err, broadcastId: String(id) }, 'Broadcast failed part-way');
    await PushBroadcast.updateOne({ _id: id }, { $set: { status: BROADCAST_STATUS.FAILED, failureReason: String(err.message).slice(0, 300) } });
  }
  return id;
}

/** The minute job: sends every scheduled broadcast whose time has come, and takes over ones whose process died mid-send. */
export async function dispatchDueBroadcasts() {
  const due = await PushBroadcast.find(claimable(new Date()), '_id').lean();
  let sent = 0;
  for (const row of due) if (await dispatchBroadcast(row._id)) sent += 1;
  return sent;
}
