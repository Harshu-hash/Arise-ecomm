import { DEAL_STATUS, MAX_DEAL_DAYS } from '../constants/coupon.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/** The calendar day (YYYY-MM-DD) an instant falls on in India, where "Deal of the Day" slots are counted. */
export const istDate = (date = new Date()) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** True for a real calendar day such as 2026-02-28, false for 2026-02-30 or free text. */
export const isCalendarDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** A deal's status follows its schedule and is never stored. `dealStatusExpr` is the same rule for list filtering/counts. */
export const dealStatus = ({ startsAt, endsAt }, now = new Date()) =>
  startsAt > now ? DEAL_STATUS.SCHEDULED : endsAt < now ? DEAL_STATUS.ENDED : DEAL_STATUS.ACTIVE;

export const dealStatusExpr = (now = new Date()) => ({
  $switch: {
    branches: [
      { case: { $gt: ['$startsAt', now] }, then: DEAL_STATUS.SCHEDULED },
      { case: { $lt: ['$endsAt', now] }, then: DEAL_STATUS.ENDED },
    ],
    default: DEAL_STATUS.ACTIVE,
  },
});

// A slot day must be today or later and fall inside the days the deal runs.
export function slotError(slotDate, { startsAt, endsAt }, now = new Date()) {
  if (slotDate < istDate(now)) return 'The slot is in the past.';
  if (slotDate < istDate(startsAt) || slotDate > istDate(endsAt)) return 'The slot must fall within the days the deal runs.';
  return null;
}

/** Field errors for an inconsistent deal, or null when it is fine. `shelfPricePaise` is today's price of the product. */
export function dealErrors({ dealPricePaise, shelfPricePaise, startsAt, endsAt, slotDate }, now = new Date()) {
  const errors = {};
  if (dealPricePaise >= shelfPricePaise) errors.dealPricePaise = [`Deal price must be below the current price of ₹${(shelfPricePaise / 100).toLocaleString('en-IN')}.`];
  if (endsAt <= now) errors.endsAt = ['The end date is in the past.'];
  else if (startsAt >= endsAt) errors.endsAt = ['The end must be after the start.'];
  else if (endsAt - startsAt > MAX_DEAL_DAYS * DAY_MS) errors.endsAt = [`A deal can run for at most ${MAX_DEAL_DAYS} days.`];
  if (slotDate && !errors.endsAt) {
    const message = slotError(slotDate, { startsAt, endsAt }, now);
    if (message) errors.slotDate = [message];
  }
  return Object.keys(errors).length ? errors : null;
}
