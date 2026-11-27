import { CATEGORY, notify } from '../../notification/public/index.js';
import { getPurchasableOffers } from '../../product/public/index.js';
import { Cart } from '../infrastructure/persistence/cart.model.js';

const HOUR_MS = 3_600_000;
const NUDGE_AFTER_HOURS = 24; // a cart left alone this long gets one nudge...
const GIVE_UP_AFTER_HOURS = 72; // ...and only while it is still this fresh
const LOW_STOCK_UNITS = 5;
const BATCH = 500;

/**
 * "You left something in your cart", and "only a few left" for items saved for later. Safe to run hourly: each message has
 * its own key (a cart's nudge is per cart version, so a changed cart can be nudged again), so nothing is sent twice.
 * shortcut: an hourly scan capped at BATCH carts per kind; move to a "nudged" marker if volume outgrows it.
 * Returns how many were sent.
 */
export async function sendCartReminders(now = new Date()) {
  let sent = 0;
  const idle = { $gte: new Date(now.getTime() - GIVE_UP_AFTER_HOURS * HOUR_MS), $lte: new Date(now.getTime() - NUDGE_AFTER_HOURS * HOUR_MS) };
  for (const cart of await Cart.find({ updatedAt: idle, items: { $elemMatch: { savedForLater: false } } }).limit(BATCH).lean()) {
    const count = cart.items.filter((item) => !item.savedForLater).length;
    const first = cart.items.find((item) => !item.savedForLater)?.snapshot?.name ?? 'your items';
    const told = await notify({
      to: { type: 'CUSTOMER', id: cart.customerId }, category: CATEGORY.OFFER, key: `abandoned-cart:${cart.customerId}:${cart.version}`,
      title: 'You left something in your cart', body: count > 1 ? `${first} and ${count - 1} more are waiting for you.` : `${first} is waiting for you.`,
      target: { type: 'CART', entityId: null },
    });
    if (told) sent += 1;
  }

  const saved = await Cart.find({ updatedAt: { $gte: new Date(now.getTime() - 30 * 24 * HOUR_MS) }, items: { $elemMatch: { savedForLater: true } } }).limit(BATCH).lean();
  const offers = await getPurchasableOffers([...new Set(saved.flatMap((cart) => cart.items.filter((item) => item.savedForLater).map((item) => String(item.offerId))))]);
  for (const cart of saved) {
    for (const item of cart.items.filter((line) => line.savedForLater)) {
      const units = offers.get(String(item.offerId))?.availableUnits ?? 0;
      if (units < 1 || units > LOW_STOCK_UNITS) continue;
      const told = await notify({
        to: { type: 'CUSTOMER', id: cart.customerId }, category: CATEGORY.OFFER, key: `low-stock:${cart.customerId}:${item.offerId}:${units}`,
        title: 'Selling out fast', body: `Only ${units} left of ${item.snapshot?.name ?? 'an item you saved'}.`,
        target: { type: 'PRODUCT', entityId: item.snapshot?.productId ?? null },
      });
      if (told) sent += 1;
    }
  }
  return sent;
}
