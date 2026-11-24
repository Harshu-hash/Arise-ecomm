// Date windows and ratios for the dashboards. Pure. Days are Indian calendar days (IST), because that is what the people reading them mean by "today".

export const TZ = 'Asia/Kolkata';
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' of an instant, in IST. */
export const dayKey = (date) => new Date(date.getTime() + IST_MS).toISOString().slice(0, 10);

/** The instant an IST day starts. */
export const startOfDay = (key) => new Date(`${key}T00:00:00+05:30`);

/** The instant just after an IST day ends. */
export const endOfDay = (key) => new Date(startOfDay(key).getTime() + DAY_MS);

const addDays = (key, n) => dayKey(new Date(startOfDay(key).getTime() + n * DAY_MS));

/** The `days` day keys ending on `endKey` (oldest first). */
export const daysEndingOn = (endKey, days) => Array.from({ length: days }, (_, i) => addDays(endKey, i - days + 1));

/** The last `days` days, and the same number before them (for "vs previous period"). */
export function windows(days, now = new Date()) {
  const today = dayKey(now);
  const current = daysEndingOn(today, days);
  const previous = daysEndingOn(addDays(current[0], -1), days);
  return { current, previous, since: startOfDay(previous[0]), currentSince: startOfDay(current[0]) };
}

/** A from/to (inclusive day keys) as the keys in between, capped so a wrong request cannot ask for years. */
export function rangeDays(from, to, max = 366) {
  const keys = [];
  for (let key = from; key <= to && keys.length < max; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/** One entry per day, zero where nothing happened. `rows`: Map day -> partial entry. */
export const fillDays = (keys, rows, empty) => keys.map((date) => ({ date, ...empty, ...rows.get(date) }));

export const pct = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(2)) : 0);

/** Change from `previous` to `current` in percent; null when there was nothing to compare with. */
export const deltaPct = (current, previous) => (previous ? Number((((current - previous) / previous) * 100).toFixed(1)) : null);

export const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);

/** Parcels at or past each stage of fulfilment, for the funnel. `counts`: { STATUS: n }. */
export function fulfilmentFunnel(counts) {
  const n = (...statuses) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const all = Object.values(counts).reduce((total, value) => total + value, 0);
  const accepted = n('ACCEPTED', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'RTO', 'RTO_DELIVERED');
  const packed = n('READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'RTO', 'RTO_DELIVERED');
  const shipped = n('SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'RTO', 'RTO_DELIVERED');
  return [
    { stage: 'Placed', count: all },
    { stage: 'Accepted', count: accepted },
    { stage: 'Packed', count: packed },
    { stage: 'Shipped', count: shipped },
    { stage: 'Delivered', count: n('DELIVERED') },
  ];
}
