import { BANNER_STATUS } from '../constants/banner.js';

// A banner's status is never stored: it follows its schedule, so it can never be stale.
export function bannerStatus({ startsAt, endsAt }, now = new Date()) {
  if (startsAt > now) return BANNER_STATUS.SCHEDULED;
  if (endsAt < now) return BANNER_STATUS.EXPIRED;
  return BANNER_STATUS.LIVE;
}

// The same rule as a Mongo filter, for list filtering by status.
export function statusFilter(statuses, now = new Date()) {
  const byStatus = {
    [BANNER_STATUS.SCHEDULED]: { startsAt: { $gt: now } },
    [BANNER_STATUS.EXPIRED]: { endsAt: { $lt: now } },
    [BANNER_STATUS.LIVE]: { startsAt: { $lte: now }, endsAt: { $gte: now } },
  };
  return { $or: statuses.map((status) => byStatus[status]).filter(Boolean) };
}

export const isValidWindow = (startsAt, endsAt) => startsAt < endsAt;
