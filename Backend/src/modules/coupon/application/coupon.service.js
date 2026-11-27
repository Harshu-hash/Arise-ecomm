import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { emitTo, rooms } from '../../../infrastructure/realtime/socket.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { countCustomers, getCustomer } from '../../identity/public/index.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { getShelfPrices } from '../../product/public/index.js';
import { COUPON_STATE, COUPON_STATUS, MAX_COUPON_DAYS } from '../domain/constants/coupon.js';
import { burnExpr, couponErrors, evaluateCoupon, statusExpr } from '../domain/services/couponRules.js';
import { Coupon } from '../infrastructure/persistence/coupon.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const S = COUPON_STATUS;
const OPEN = [S.ACTIVE, S.SCHEDULED, S.PAUSED];
// The discount itself is frozen once anyone has redeemed the coupon.
const VALUE_FIELDS = { PERCENT: ['valuePct', 'maxDiscountPaise'], FLAT: ['valuePaise'], BXGY: ['buyQty', 'getQty'], FREE_DELIVERY: [] };
const EDITABLE = ['name', 'description', 'terms', 'minCartPaise', 'audience', 'stackable', 'visibility', 'totalLimit', 'perUserLimit', 'budgetPaise', 'endsAt'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (errors) => new ValidationError('Invalid coupon.', errors);
const closed = () => new ConflictError('COUPON_CLOSED', 'This coupon has already ended. Clone it to run a new one.');
const illegal = (status, action) => new ConflictError('ILLEGAL_TRANSITION', `This coupon is ${status.toLowerCase()}, so it cannot be ${action}.`);

// Every read adds the derived status and burn % in the database, so there is one definition of both.
const withDerived = (now) => [{ $addFields: { status: statusExpr(now), budgetBurnPct: burnExpr } }];

export function serializeCoupon(row) {
  return {
    id: String(row._id),
    code: row.code,
    name: row.name,
    description: row.description,
    terms: row.terms,
    type: row.type,
    valuePct: row.valuePct,
    valuePaise: row.valuePaise,
    maxDiscountPaise: row.maxDiscountPaise,
    buyQty: row.buyQty,
    getQty: row.getQty,
    minCartPaise: row.minCartPaise,
    audience: { type: row.audience.type, customerIds: (row.audience.customerIds ?? []).map(String) },
    fundedBy: row.fundedBy,
    stackable: row.stackable,
    visibility: row.visibility,
    totalLimit: row.totalLimit,
    totalRedemptions: row.totalRedemptions,
    perUserLimit: row.perUserLimit,
    budgetPaise: row.budgetPaise,
    budgetUsedPaise: row.budgetUsedPaise,
    budgetBurnPct: row.budgetBurnPct,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

// With a sellerId only that seller's own coupons are visible (anything else is simply "not found").
async function findCoupon(id, sellerId = null) {
  const match = { _id: new mongoose.Types.ObjectId(id), ...(sellerId ? { sellerId } : {}) };
  const [row] = await Coupon.aggregate([{ $match: match }, ...withDerived(new Date())]);
  if (!row) throw new NotFoundError('That coupon no longer exists.');
  return row;
}

// A coupon aimed at named customers is announced to them; a public one is announced with a broadcast (admin Notifications) instead.
const tellTargetedCustomers = (coupon) => coupon.audience?.type === 'CUSTOM'
  ? Promise.all(coupon.audience.customerIds.map((id) => notify({
    to: { type: 'CUSTOMER', id: String(id) }, category: CATEGORY.OFFER, key: `coupon-for-you:${coupon._id}:${id}`,
    title: 'A coupon just for you', body: `Use ${coupon.code}: ${coupon.name}. Valid until ${coupon.endsAt.toLocaleDateString('en-IN')}.`,
  })))
  : null;

/** One push the day before a targeted coupon expires, to each customer it was made for. Keyed per coupon and customer. Returns how many were sent. */
export async function sendCouponExpiryReminders(now = new Date()) {
  let sent = 0;
  for (const coupon of await Coupon.find({ state: COUPON_STATE.LIVE, 'audience.type': 'CUSTOM', endsAt: { $gt: now, $lte: new Date(now.getTime() + 86_400_000) } }).limit(200).lean()) {
    for (const id of coupon.audience.customerIds) {
      const told = await notify({
        to: { type: 'CUSTOMER', id: String(id) }, category: CATEGORY.OFFER, key: `coupon-expiring:${coupon._id}:${id}`,
        title: 'Your coupon expires soon', body: `${coupon.code} (${coupon.name}) ends ${coupon.endsAt.toLocaleDateString('en-IN')}. Use it before it goes.`,
      });
      if (told) sent += 1;
    }
  }
  return sent;
}

// A seller's console refetches when their coupon changes, including when an admin pauses it.
const announce = (coupon) => coupon.sellerId && emitTo(rooms.seller(coupon.sellerId), 'coupon:changed', { id: String(coupon._id) });

/** The slice of a coupon a seller sees: no audience, funding or budget internals. */
export const toSellerCoupon = (c) => ({
  id: c.id, code: c.code, name: c.name, description: c.description, type: c.type, valuePct: c.valuePct, valuePaise: c.valuePaise,
  maxDiscountPaise: c.maxDiscountPaise, minCartPaise: c.minCartPaise, totalLimit: c.totalLimit, perUserLimit: c.perUserLimit,
  totalRedemptions: c.totalRedemptions, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status, createdAt: c.createdAt,
});

export async function listCoupons({ page, pageSize, q, type, fundedBy, status, sortField, sortDirection, sellerId }) {
  const base = {
    ...(q ? { $or: [{ code: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] } : {}),
    ...(fundedBy ? { fundedBy } : {}),
    ...(sellerId ? { sellerId } : {}),
  };
  const filters = { ...(type.length ? { type: { $in: type } } : {}), ...(status.length ? { status: { $in: status } } : {}) };
  const [result] = await Coupon.aggregate([
    { $match: base },
    ...withDerived(new Date()),
    {
      $facet: {
        rows: [{ $match: filters }, { $sort: { [sortField]: sortDirection, _id: 1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        total: [{ $match: filters }, { $count: 'n' }],
        // Tab/filter badges ignore the status and type filters so each keeps its own count.
        status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        type: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
      },
    },
  ]);
  const total = result.total[0]?.n ?? 0;
  const toMap = (items) => Object.fromEntries(items.map((item) => [item._id, item.count]));
  return {
    data: result.rows.map(serializeCoupon),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { status: toMap(result.status), type: toMap(result.type) } },
  };
}

export async function getCoupon(id) {
  const row = await findCoupon(id);
  return {
    ...serializeCoupon(row),
    // Redemptions and GMV come from orders, which do not exist yet: only the counters checkout will advance are real.
    performance: { redemptions: row.totalRedemptions, discountGivenPaise: row.budgetUsedPaise, gmvInfluencedPaise: 0, newCustomersAcquired: 0 },
    redemptions: [],
  };
}

// Custom audiences must be real, active customers: a typo'd id would silently exclude someone.
async function assertAudience(audience) {
  if (audience?.type !== 'CUSTOM') return;
  const ids = [...new Set(audience.customerIds)];
  if ((await countCustomers(ids)) !== ids.length) throw fail({ audience: ['Some of the chosen customers no longer exist.'] });
}

const startInPast = (startsAt) => startsAt < new Date(Date.now() - DAY_MS);
const tooLong = (startsAt, endsAt) => endsAt - startsAt > MAX_COUPON_DAYS * DAY_MS;

export async function createCoupon(input, actor) {
  const errors = couponErrors({ ...input, totalRedemptions: 0, budgetUsedPaise: 0 });
  if (errors) throw fail(errors);
  // Whole days are picked in the admin's timezone, so a day of grace keeps "today" valid anywhere.
  if (startInPast(input.startsAt)) throw fail({ startsAt: ['The start date is in the past.'] });
  if (tooLong(input.startsAt, input.endsAt)) throw fail({ endsAt: [`A coupon can run for at most ${MAX_COUPON_DAYS} days.`] });
  await assertAudience(input.audience);
  let row;
  try {
    row = await Coupon.create({ ...input, createdBy: actor.userId });
  } catch (error) {
    if (error?.code === 11000) throw fail({ code: ['That code is already in use.'] });
    throw error;
  }
  const result = await findCoupon(row._id).then(serializeCoupon);
  await recordAudit({ action: 'marketing.coupon.create', subjectType: 'coupon', subjectId: row._id, after: result, actor });
  announce(row);
  await tellTargetedCustomers(row);
  return result;
}

export async function updateCoupon(id, patch, actor) {
  const before = await findCoupon(id);
  if ([S.EXPIRED, S.EXHAUSTED].includes(before.status)) throw closed();

  const set = Object.fromEntries(EDITABLE.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
  // A start that has already passed is history; only an unstarted coupon may be rescheduled.
  if (patch.startsAt && [S.DRAFT, S.SCHEDULED].includes(before.status)) set.startsAt = patch.startsAt;
  const changedValues = VALUE_FIELDS[before.type].filter((key) => patch[key] !== undefined && patch[key] !== before[key]);
  if (changedValues.length && before.totalRedemptions > 0) {
    throw fail(Object.fromEntries(changedValues.map((key) => [key, ['The discount cannot change after the coupon has been redeemed. Clone it instead.']])));
  }
  for (const key of changedValues) set[key] = patch[key];

  const merged = { ...before, ...set };
  const errors = couponErrors(merged);
  if (errors) throw fail(errors);
  if (set.startsAt && set.startsAt.getTime() !== before.startsAt.getTime() && startInPast(set.startsAt)) {
    throw fail({ startsAt: ['The start date is in the past.'] });
  }
  if (tooLong(merged.startsAt, merged.endsAt)) throw fail({ endsAt: [`A coupon can run for at most ${MAX_COUPON_DAYS} days.`] });
  await assertAudience(set.audience);

  // Saving a draft (e.g. a clone) is what activates it.
  const state = before.state === COUPON_STATE.DRAFT ? COUPON_STATE.LIVE : before.state;
  // Guarded on state so an edit cannot land on a coupon that was paused or ended a moment ago.
  const updated = await Coupon.findOneAndUpdate({ _id: id, state: before.state }, { $set: { ...set, state } }, { new: true }).lean();
  if (!updated) throw new ConflictError('COUPON_CHANGED', 'This coupon was just changed by someone else. Reload and try again.');
  const result = await findCoupon(id).then(serializeCoupon);
  await recordAudit({ action: 'marketing.coupon.edit', subjectType: 'coupon', subjectId: id, before: serializeCoupon(before), after: result, actor });
  announce(before);
  return result;
}

/** Explicit pause/resume (safe to call twice from two screens): pause needs ACTIVE or SCHEDULED, resume needs PAUSED. */
export async function setCouponPaused(id, paused, actor, sellerId = null) {
  const before = await findCoupon(id, sellerId);
  if (paused && before.status === S.PAUSED) throw new ConflictError('ILLEGAL_TRANSITION', 'This coupon is already paused.');
  if (!paused && [S.ACTIVE, S.SCHEDULED].includes(before.status)) throw new ConflictError('ILLEGAL_TRANSITION', 'This coupon is already running.');
  if (paused ? ![S.ACTIVE, S.SCHEDULED].includes(before.status) : before.status !== S.PAUSED) throw illegal(before.status, paused ? 'paused' : 'resumed');
  const updated = await Coupon.findOneAndUpdate({ _id: id, state: before.state }, { $set: { state: paused ? COUPON_STATE.PAUSED : COUPON_STATE.LIVE } }, { new: true }).lean();
  if (!updated) throw new ConflictError('COUPON_CHANGED', 'This coupon was just changed by someone else. Reload and try again.');
  const result = await findCoupon(id, sellerId).then(serializeCoupon);
  await recordAudit({ action: paused ? 'marketing.coupon.pause' : 'marketing.coupon.resume', subjectType: 'coupon', subjectId: id, after: { status: result.status }, actor });
  announce(before);
  return result;
}

// The admin console's single button toggles.
export async function togglePauseCoupon(id, actor) {
  const { status } = await findCoupon(id);
  return setCouponPaused(id, status !== S.PAUSED, actor);
}

export async function endCoupon(id, actor, sellerId = null) {
  const before = await findCoupon(id, sellerId);
  if (!OPEN.includes(before.status)) throw illegal(before.status, 'ended');
  const now = new Date();
  // An unstarted coupon is pulled back to now as well, so its window never ends before it starts.
  await Coupon.updateOne({ _id: id }, { $set: { state: COUPON_STATE.ENDED, endsAt: now, ...(before.startsAt > now ? { startsAt: now } : {}) } });
  const result = await findCoupon(id, sellerId).then(serializeCoupon);
  await recordAudit({ action: 'marketing.coupon.end', subjectType: 'coupon', subjectId: id, before: { status: before.status }, after: { status: result.status }, actor });
  announce(before);
  return result;
}

export async function cloneCoupon(id, actor) {
  const source = await findCoupon(id);
  const base = source.code.replace(/-\d+$/, '').slice(0, 16);
  const taken = await Coupon.find({ code: new RegExp(`^${escapeRegex(base)}-\\d+$`) }, 'code').lean();
  const next = Math.max(1, ...taken.map((row) => Number(row.code.slice(base.length + 1)))) + 1;
  const now = new Date();
  const runMs = Math.min(source.endsAt - source.startsAt, MAX_COUPON_DAYS * DAY_MS);
  const { _id, status, budgetBurnPct, createdAt, updatedAt, ...copy } = source;
  const row = await Coupon.create({
    ...copy,
    code: `${base}-${next}`,
    name: `${source.name} (copy)`.slice(0, 80),
    state: COUPON_STATE.DRAFT,
    totalRedemptions: 0,
    budgetUsedPaise: 0,
    startsAt: now,
    endsAt: new Date(now.getTime() + runMs),
    createdBy: actor.userId,
  });
  const result = await findCoupon(row._id).then(serializeCoupon);
  await recordAudit({ action: 'marketing.coupon.clone', subjectType: 'coupon', subjectId: row._id, after: { clonedFrom: source.code, code: result.code }, actor });
  return result;
}

/** "Test against a cart": the same evaluator checkout will use, over today's real shelf prices. */
export async function testCoupon(id, { customerId, productIds }) {
  const [coupon, customer, prices] = await Promise.all([findCoupon(id), getCustomer(customerId), getShelfPrices(productIds)]);
  if (!customer) throw fail({ customerId: ['Choose an active customer.'] });
  const missing = productIds.filter((productId) => !prices.has(productId));
  if (missing.length) throw fail({ productIds: [`${missing.length} product(s) are not live or have no live offer.`] });
  // No orders exist yet, so every customer is a first-time buyer and has redeemed nothing.
  return evaluateCoupon(coupon, {
    customer: { id: customer.id, ordersCount: 0 },
    items: productIds.map((productId) => ({ productId, sellerId: prices.get(productId).sellerId, pricePaise: prices.get(productId).pricePaise, qty: 1 })),
    redeemedByCustomer: 0,
  });
}

/** Estimated number of customers an audience reaches (shown while choosing it). */
export async function audienceReach(audience) {
  if (audience.type === 'CUSTOM') return { reach: await countCustomers([...new Set(audience.customerIds)]) };
  // NEW = customers with no order yet; with no orders in the system that is every customer.
  return { reach: await countCustomers() };
}
