import { CATEGORY, notify } from '../../notification/public/index.js';
import { returnWindowEndsAt } from '../domain/services/orderStatus.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { Return } from '../infrastructure/persistence/return.model.js';

const DAY_MS = 86_400_000;
const WARN_BEFORE_DAYS = 1; // "last day to return" goes out when this little time is left
const LONGEST_WINDOW_DAYS = 60; // parcels delivered longer ago than this cannot still be inside a window
const BATCH = 500;

/**
 * "Last day to return": one push per delivered parcel with an item whose return window ends within a day and that has no
 * return yet. Safe to run hourly: the message is keyed by parcel. Returns how many were sent.
 * shortcut: an hourly scan of recent deliveries capped at BATCH orders; move to a "warned" marker if volume outgrows it.
 */
export async function sendReturnWindowReminders(now = new Date()) {
  const orders = await Order.find({ subOrders: { $elemMatch: { status: 'DELIVERED', deliveredAt: { $gte: new Date(now.getTime() - LONGEST_WINDOW_DAYS * DAY_MS) } } } }).sort({ _id: -1 }).limit(BATCH).lean();
  if (!orders.length) return 0;
  const returned = new Set((await Return.find({ orderId: { $in: orders.map((order) => order._id) } }, 'itemId').lean()).map((row) => String(row.itemId)));
  let sent = 0;
  for (const order of orders) {
    for (const sub of order.subOrders) {
      if (sub.status !== 'DELIVERED') continue;
      const closing = sub.items.filter((item) => {
        const ends = !returned.has(String(item._id)) && returnWindowEndsAt(sub, item);
        return ends && ends > now && ends.getTime() - now.getTime() <= WARN_BEFORE_DAYS * DAY_MS;
      });
      if (!closing.length) continue;
      const told = await notify({
        to: { type: 'CUSTOMER', id: order.customerId }, category: CATEGORY.ORDER, key: `return-window:${sub._id}`,
        title: 'Last day to return', body: `The return window for ${closing[0].name}${closing.length > 1 ? ` and ${closing.length - 1} more` : ''} (order ${order.number}) closes within a day.`,
        target: { type: 'ORDER', entityId: String(order._id) },
      });
      if (told) sent += 1;
    }
  }
  return sent;
}
