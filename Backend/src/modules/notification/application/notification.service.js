import { NotFoundError } from '../../../shared/errors/AppError.js';
import { Device } from '../infrastructure/persistence/device.model.js';
import { Notification } from '../infrastructure/persistence/notification.model.js';
import { Preference } from '../infrastructure/persistence/preference.model.js';

const CUSTOMER = 'CUSTOMER';
const SELLER = 'SELLER';

/* --------------------------------------------------------------------------------------------- customers */

const toDto = (row) => ({
  id: String(row._id),
  deduplicationKey: row.deduplicationKey,
  category: row.category,
  title: row.title,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  readAt: row.readAt?.toISOString() ?? null,
  target: { type: row.target.type, entityId: row.target.entityId ?? null },
});

/** Newest first, a page at a time (`cursor` is the last id seen). */
export async function listNotifications(customerId, { limit = 20, cursor } = {}) {
  const own = { recipientType: CUSTOMER, recipientId: String(customerId) };
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(cursor ? { ...own, _id: { $lt: cursor } } : own).sort({ _id: -1 }).limit(limit + 1).lean(),
    Notification.countDocuments(own),
    Notification.countDocuments({ ...own, readAt: null }),
  ]);
  const page = rows.slice(0, limit);
  return { items: page.map(toDto), unreadCount, total, nextCursor: rows.length > limit ? String(page.at(-1)._id) : null };
}

export async function markRead(customerId, notificationId) {
  const row = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientType: CUSTOMER, recipientId: String(customerId) },
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }], // keeps the first time it was read
    { new: true },
  ).lean();
  if (!row) throw new NotFoundError('This notification does not exist.');
  return toDto(row);
}

export async function markAllRead(customerId) {
  const { modifiedCount } = await Notification.updateMany({ recipientType: CUSTOMER, recipientId: String(customerId), readAt: null }, { $set: { readAt: new Date() } });
  return { updated: modifiedCount };
}

const preferenceDto = (row) => ({
  orders: row.orders,
  delivery: row.delivery,
  offers: row.offers,
  account: row.account,
  support: row.support,
  pushPermission: row.pushPermission,
  updatedAt: (row.updatedAt ?? new Date()).toISOString(),
});

const DEFAULT_PREFERENCES = { orders: true, delivery: true, offers: true, account: true, support: true, pushPermission: 'NOT_DETERMINED' };

export async function getPreferences(customerId) {
  return preferenceDto((await Preference.findOne({ customerId: String(customerId) }).lean()) ?? DEFAULT_PREFERENCES);
}

export async function updatePreferences(customerId, patch) {
  return preferenceDto(await Preference.findOneAndUpdate({ customerId: String(customerId) }, { $set: patch }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean());
}

/** Remembers a phone for pushes. The same device registering again (a new token after a reinstall) just updates it. */
export async function registerDevice(customerId, { deviceId, token, platform }) {
  await Device.updateOne({ userId: String(customerId), deviceId }, { $set: { token, platform, invalidAt: null } }, { upsert: true });
  // a token belongs to one phone: if it was registered under another account (a shared phone), that account stops getting it
  await Device.updateMany({ token, $or: [{ userId: { $ne: String(customerId) } }, { deviceId: { $ne: deviceId } }] }, { $set: { invalidAt: new Date() } });
  return { registered: true, deviceId };
}

export async function unregisterDevice(customerId, deviceId) {
  await Device.deleteOne({ userId: String(customerId), deviceId });
  return { registered: false, deviceId };
}

/* ----------------------------------------------------------------------------------------------- sellers */

/** The seller panel's header bell: newest first, with how many are unread. */
export async function listSellerAlerts(sellerId) {
  const own = { recipientType: SELLER, recipientId: String(sellerId) };
  const [rows, unread] = await Promise.all([Notification.find(own).sort({ _id: -1 }).limit(50).lean(), Notification.countDocuments({ ...own, readAt: null })]);
  return {
    data: rows.map((row) => ({ id: row.deduplicationKey, title: row.title, body: row.body, at: row.createdAt.toISOString(), severity: row.severity, link: row.link, read: Boolean(row.readAt) })),
    meta: { unread },
  };
}

export async function markSellerAlertRead(sellerId, key) {
  await Notification.updateOne({ recipientType: SELLER, recipientId: String(sellerId), deduplicationKey: key, readAt: null }, { $set: { readAt: new Date() } });
  return { ok: true };
}
