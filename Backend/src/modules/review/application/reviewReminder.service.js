import { CATEGORY, notify } from '../../notification/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { REFUNDED_RETURN_STATUSES } from '../domain/services/reviewRules.js';
import { Review } from '../infrastructure/persistence/review.model.js';

const DAY_MS = 86_400_000;
const REMIND_AFTER_DAYS = 3; // a parcel delivered this long ago gets one nudge...
const GIVE_UP_AFTER_DAYS = 14; // ...and only if it was delivered within this window (older ones are left alone)
const BATCH = 500;

/**
 * "Rate your purchase": one push per delivered parcel that still has an item to review (not reviewed, not refunded).
 * Safe to run every hour: each parcel's message has its own key, so it is sent once however often this runs.
 * Returns how many were sent.
 */
export async function sendReviewReminders(now = new Date()) {
  const delivered = { $gte: new Date(now.getTime() - GIVE_UP_AFTER_DAYS * DAY_MS), $lte: new Date(now.getTime() - REMIND_AFTER_DAYS * DAY_MS) };
  // shortcut: an hourly scan of the delivery window, capped at BATCH orders; move to a "reminded" marker if volume outgrows it.
  const orders = await Order.find({ subOrders: { $elemMatch: { status: 'DELIVERED', deliveredAt: delivered } } }).sort({ _id: -1 }).limit(BATCH).lean();
  if (!orders.length) return 0;

  const orderIds = orders.map((order) => order._id);
  const [reviewed, refunded] = await Promise.all([
    Review.find({ orderId: { $in: orderIds } }, 'orderItemId').lean(),
    Return.find({ orderId: { $in: orderIds }, status: { $in: REFUNDED_RETURN_STATUSES } }, 'itemId').lean(),
  ]);
  const skip = new Set([...reviewed.map((row) => String(row.orderItemId)), ...refunded.map((row) => String(row.itemId))]);

  let sent = 0;
  for (const order of orders) {
    for (const sub of order.subOrders) {
      if (sub.status !== 'DELIVERED' || !sub.deliveredAt || sub.deliveredAt < delivered.$gte || sub.deliveredAt > delivered.$lte) continue;
      const open = sub.items.filter((item) => !skip.has(String(item._id)));
      if (!open.length) continue;
      const more = open.length > 1 ? ` and ${open.length - 1} more` : '';
      const told = await notify({
        to: { type: 'CUSTOMER', id: order.customerId },
        category: CATEGORY.ORDER,
        key: `review-reminder:${sub._id}`,
        title: 'How was your order?',
        body: `Rate ${open[0].name}${more} and help other shoppers.`,
        target: { type: 'ORDER', entityId: String(order._id) },
      });
      if (told) sent += 1;
    }
  }
  return sent;
}
