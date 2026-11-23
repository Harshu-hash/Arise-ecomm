import { logger } from '../../../config/logger.js';
import { notificationChanged } from '../../../infrastructure/realtime/orderEvents.js';
import { fcm } from '../../../infrastructure/external/notification/fcm.js';
import { enqueueEmail } from '../../../infrastructure/queue/notification.queue.js';
import { Device } from '../infrastructure/persistence/device.model.js';
import { Notification } from '../infrastructure/persistence/notification.model.js';
import { Preference } from '../infrastructure/persistence/preference.model.js';

const DUPLICATE_KEY = 11000;
const PREFERENCE_OF = { ORDER: 'orders', DELIVERY: 'delivery', OFFER: 'offers', ACCOUNT: 'account', SUPPORT: 'support' };

async function pushToCustomer(customerId, notification) {
  if (!fcm.configured()) return;
  const preference = await Preference.findOne({ customerId }, 'orders delivery offers account support pushPermission').lean();
  if (preference && (preference[PREFERENCE_OF[notification.category]] === false || preference.pushPermission === 'DENIED')) return;
  const devices = await Device.find({ userId: customerId, invalidAt: null }, 'token').lean();
  await Promise.all(devices.map(async (device) => {
    try {
      const result = await fcm.send({
        token: device.token,
        title: notification.title,
        body: notification.body,
        data: { notificationId: String(notification._id), targetType: notification.target.type, entityId: notification.target.entityId ?? '' },
      });
      if (result.invalidToken) await Device.updateOne({ _id: device._id }, { $set: { invalidAt: new Date() } });
    } catch (err) {
      logger.warn({ err, deviceId: String(device._id) }, 'Push notification failed');
    }
  }));
}

/**
 * Tells someone something happened. The in-app message is saved first (once per `key`: telling again about the same event
 * does nothing, so a retried or repeated event never doubles up); the push and the email then go out in the background.
 * Never throws: a notification problem must not undo or fail the thing it is about.
 *
 * @param to        { type: 'CUSTOMER' | 'SELLER', id }
 * @param key       names the event, e.g. `sub:<id>:SHIPPED`
 * @param target    { type: ORDER | SHIPMENT | ..., entityId } what opening it should show (customers)
 * @param severity,link   for sellers' bell: 'info' | 'warning' | 'error', and a panel route
 * @param email     { to, subject, text, html? } sent through the mail queue (receipts: not subject to push preferences)
 */
export async function notify({ to, category, title, body, key, target = { type: 'NONE', entityId: null }, severity = 'info', link = null, email = null }) {
  try {
    let notification;
    try {
      notification = await Notification.create({ recipientType: to.type, recipientId: String(to.id), category, title, body, deduplicationKey: key, target, severity, link });
    } catch (error) {
      if (error?.code === DUPLICATE_KEY) return null; // already told
      throw error;
    }
    notificationChanged(to.type, to.id);
    if (to.type === 'CUSTOMER') pushToCustomer(String(to.id), notification).catch((err) => logger.warn({ err }, 'Push notification failed'));
    if (email?.to) enqueueEmail({ ...email, dedupeKey: `notify-${to.type}-${to.id}-${key}`.replaceAll(':', '-') }).catch((err) => logger.warn({ err }, 'Notification email failed'));
    return notification;
  } catch (err) {
    logger.error({ err, key }, 'Could not create a notification');
    return null;
  }
}
