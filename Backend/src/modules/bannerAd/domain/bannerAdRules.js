// Paid shop-banner slots: pricing, dates and lifecycle. Pure functions, no I/O.
export const GST_PCT = 18;
export const MAX_BOOKING_DAYS = 90;
export const HOLD_MINUTES = 15; // an unpaid booking keeps its dates this long

export const BOOKING_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT', // dates held, waiting for the seller's Razorpay payment
  PENDING_REVIEW: 'PENDING_REVIEW', // paid, waiting for admin
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED', // refunded
  EXPIRED: 'EXPIRED', // never paid within the hold
});
export const PAYMENT_STATUS = Object.freeze({ PENDING: 'PENDING', PAID: 'PAID', REFUND_PENDING: 'REFUND_PENDING', REFUNDED: 'REFUNDED' });

/** Statuses whose dates nobody else may book. */
export const HOLDING_STATUSES = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PENDING_REVIEW, BOOKING_STATUS.APPROVED];

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDay(value) {
  const match = DAY_PATTERN.exec(String(value ?? ''));
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null; // rejects 2026-02-31
}

/** Today in India (UTC+5:30), as the sellers and admins see the calendar. */
export const todayIst = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** Every YYYY-MM-DD from start to end inclusive; null for a malformed or backwards range. */
export function enumerateDays(startsOn, endsOn) {
  const start = utcDay(startsOn);
  const end = utcDay(endsOn);
  if (start === null || end === null || end < start) return null;
  const days = [];
  for (let ms = start; ms <= end; ms += DAY_MS) days.push(new Date(ms).toISOString().slice(0, 10));
  return days;
}

export function bannerAdPrice({ days, dailyRatePaise }) {
  const subtotalPaise = days * dailyRatePaise;
  const gstPaise = Math.round((subtotalPaise * GST_PCT) / 100);
  return { days, dailyRatePaise, subtotalPaise, gstPct: GST_PCT, gstPaise, totalPaise: subtotalPaise + gstPaise };
}

/** What the seller and admin see: approved bookings follow their dates. */
export function displayStatus({ status, startsOn, endsOn }, today = todayIst()) {
  if (status !== BOOKING_STATUS.APPROVED) return status;
  if (today < startsOn) return 'SCHEDULED';
  if (today > endsOn) return 'COMPLETED';
  return 'LIVE';
}
