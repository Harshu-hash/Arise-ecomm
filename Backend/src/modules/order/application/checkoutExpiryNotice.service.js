import { CATEGORY, notify } from '../../notification/public/index.js';
import { Payment } from '../../payment/public/index.js';
import { CheckoutSession, SESSION_STATUS } from '../infrastructure/persistence/checkoutSession.model.js';

const HOUR_MS = 3_600_000;
const LOOKBACK_HOURS = 3; // longer than the hourly run, so a missed run still catches it; the key stops repeats

/**
 * An order is only placed once payment succeeds, so "cancelled for non-payment" means a checkout whose time ran out after
 * the customer had started paying: they hear that nothing was charged and the items were released. Returns how many were sent.
 */
export async function sendCheckoutExpiryNotices(now = new Date()) {
  const sessions = await CheckoutSession.find({ status: SESSION_STATUS.OPEN, expiresAt: { $gte: new Date(now.getTime() - LOOKBACK_HOURS * HOUR_MS), $lte: now } }).limit(500).lean();
  if (!sessions.length) return 0;
  const ids = sessions.map((session) => String(session._id));
  const started = new Set((await Payment.find({ checkoutSessionId: { $in: ids } }, 'checkoutSessionId status').lean()).filter((payment) => payment.status !== 'SUCCEEDED').map((payment) => String(payment.checkoutSessionId)));
  let sent = 0;
  for (const session of sessions) {
    if (!started.has(String(session._id))) continue;
    const told = await notify({
      to: { type: 'CUSTOMER', id: session.customerId }, category: CATEGORY.ORDER, key: `checkout-expired:${session._id}`,
      title: 'Payment not completed', body: 'Your checkout timed out before the payment went through, so we released your items and nothing was charged. Your cart is still there: try again.',
      target: { type: 'CART', entityId: null },
    });
    if (told) sent += 1;
  }
  return sent;
}
