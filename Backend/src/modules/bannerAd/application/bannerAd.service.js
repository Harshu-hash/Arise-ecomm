import { env } from '../../../config/env.js';
import { paymentGateway } from '../../../infrastructure/external/payment/index.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { emitTo, rooms } from '../../../infrastructure/realtime/socket.js';
import { registerWebhookHandler } from '../../../infrastructure/webhooks/webhookProcessor.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { listHomeCategoryTabs } from '../../category/public/index.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { resolveMediaAssets, urlForKey } from '../../media/public/index.js';
import { listLiveProductOptions } from '../../product/public/index.js';
import {
  BOOKING_STATUS as S,
  HOLDING_STATUSES,
  HOLD_MINUTES,
  MAX_BOOKING_DAYS,
  PAYMENT_STATUS as P,
  bannerAdPrice,
  displayStatus,
  enumerateDays,
  todayIst,
} from '../domain/bannerAdRules.js';
import { BannerBooking, BannerSlot, BannerSlotDay } from '../infrastructure/persistence/bannerAd.models.js';

const id = (value) => (value ? String(value) : null);
const DUPLICATE_KEY = 11000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAID_STATUSES = [S.PENDING_REVIEW, S.APPROVED, S.REJECTED];

/* ------------------------------------------------------------------ slots (admin) */

export const serializeSlot = (row, extra = {}) => ({
  id: id(row._id),
  name: row.name,
  description: row.description,
  dailyRatePaise: row.dailyRatePaise,
  mobileWidth: row.mobileWidth,
  mobileHeight: row.mobileHeight,
  categoryId: id(row.categoryId), // null = the main For You page
  categoryName: row.categoryName ?? null,
  enabled: row.enabled,
  version: row.version,
  updatedAt: row.updatedAt,
  ...extra,
});

const nameTaken = () => new ValidationError('That slot name is taken.', { name: ['Another slot already uses this name.'] });

export async function listSlots() {
  const today = todayIst();
  const [slots, usage] = await Promise.all([
    BannerSlot.find().sort({ createdAt: 1, _id: 1 }).lean(),
    BannerBooking.aggregate([
      { $match: { status: { $in: PAID_STATUSES } } },
      {
        $group: {
          _id: '$slotId',
          total: { $sum: 1 },
          upcoming: { $sum: { $cond: [{ $and: [{ $in: ['$status', [S.PENDING_REVIEW, S.APPROVED]] }, { $gte: ['$endsOn', today] }] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const byId = new Map(usage.map((row) => [String(row._id), row]));
  return slots.map((slot) => serializeSlot(slot, { totalBookings: byId.get(String(slot._id))?.total ?? 0, upcomingBookings: byId.get(String(slot._id))?.upcoming ?? 0 }));
}

/** A slot's page must be null (For You) or one of the header category tabs the customer app shows. */
async function resolveCategory(categoryId) {
  if (!categoryId) return { categoryId: null, categoryName: null };
  const tab = (await listHomeCategoryTabs()).find((item) => item.id === categoryId);
  if (!tab) throw new ValidationError('Invalid page.', { categoryId: ['Choose For You or one of the app\'s header categories.'] });
  return { categoryId, categoryName: tab.label };
}

export async function createSlot(input, actor) {
  try {
    const row = await BannerSlot.create({ ...input, ...(await resolveCategory(input.categoryId)), nameKey: input.name.toLowerCase() });
    const result = serializeSlot(row.toObject(), { totalBookings: 0, upcomingBookings: 0 });
    await recordAudit({ action: 'ads.placement.create', subjectType: 'bannerSlot', subjectId: row._id, after: result, actor });
    return result;
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw nameTaken();
    throw error;
  }
}

// A price or size change applies to future bookings only: bookings snapshot what they bought.
export async function updateSlot(slotId, patch, actor) {
  const before = await BannerSlot.findById(slotId).lean();
  if (!before) throw new NotFoundError('That banner slot no longer exists.');
  try {
    const updated = await BannerSlot.findByIdAndUpdate(
      slotId,
      { $set: { ...patch, ...(patch.categoryId !== undefined ? await resolveCategory(patch.categoryId) : {}), ...(patch.name ? { nameKey: patch.name.toLowerCase() } : {}) }, $inc: { version: 1 } },
      { new: true },
    ).lean();
    const result = serializeSlot(updated);
    await recordAudit({ action: 'ads.placement.edit', subjectType: 'bannerSlot', subjectId: slotId, before: serializeSlot(before), after: result, actor });
    return result;
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) throw nameTaken();
    throw error;
  }
}

export async function deleteSlot(slotId, actor) {
  const slot = await BannerSlot.findById(slotId).lean();
  if (!slot) throw new NotFoundError('That banner slot no longer exists.');
  // Unpaid or lapsed holds don't count; anything paid (even rejected) keeps the slot for the records.
  if (await BannerBooking.exists({ slotId, status: { $in: [...PAID_STATUSES, S.PENDING_PAYMENT] } })) {
    throw new ConflictError('SLOT_HAS_BOOKINGS', 'This slot has bookings, so it cannot be deleted. Turn off "Available for booking" instead.');
  }
  await Promise.all([BannerBooking.deleteMany({ slotId }), BannerSlotDay.deleteMany({ slotId }), BannerSlot.deleteOne({ _id: slotId })]);
  await recordAudit({ action: 'ads.placement.delete', subjectType: 'bannerSlot', subjectId: slotId, before: serializeSlot(slot), actor });
  return { id: id(slotId) };
}

/* ------------------------------------------------------------------ bookings */

export function serializeBooking(row) {
  const creative = (c) => ({ mediaId: c.mediaId, previewUrl: urlForKey(c.key, 'PRODUCT_IMAGE'), fileName: c.fileName });
  return {
    id: id(row._id),
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    campaignName: row.campaignName,
    placementId: id(row.slotId),
    placementName: row.slotName,
    categoryId: id(row.categoryId),
    categoryName: row.categoryName ?? null,
    destinationType: row.destinationType,
    destinationValue: row.destinationValue,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    mobileCreative: creative(row.mobileCreative),
    days: row.days,
    dailyRatePaise: row.dailyRatePaise,
    subtotalPaise: row.subtotalPaise,
    gstPct: row.gstPct,
    gstPaise: row.gstPaise,
    totalPaise: row.totalPaise,
    status: displayStatus(row),
    paymentStatus: row.payment.status,
    paymentReference: row.payment.providerPaymentId,
    refundReference: row.payment.refundId,
    paidAt: row.payment.paidAt,
    submittedAt: row.submittedAt,
    holdExpiresAt: row.holdExpiresAt,
    rejectionReason: row.rejectionReason,
    decidedAt: row.decidedAt,
    impressions: row.impressions,
    clicks: row.clicks,
    createdAt: row.createdAt,
  };
}

/** Day locks for a booking. False (and nothing left behind) when any day is already taken. */
async function lockDays(slotId, days, bookingId) {
  try {
    await BannerSlotDay.insertMany(days.map((day) => ({ slotId, day, bookingId })), { ordered: false });
    return true;
  } catch (error) {
    await BannerSlotDay.deleteMany({ bookingId });
    if (error?.code === DUPLICATE_KEY || error?.writeErrors?.some((e) => e.code === DUPLICATE_KEY)) return false;
    throw error;
  }
}
const slotBooked = () => new ConflictError('SLOT_BOOKED', 'Some of these dates were just booked by someone else. Pick other dates for this slot.');

// shortcut: unpaid holds are released lazily when someone reads or books, not by a timer;
// upgrade to a scheduler job if holds must free up with nobody around.
export async function releaseExpiredHolds(now = new Date()) {
  const stale = await BannerBooking.find({ status: S.PENDING_PAYMENT, holdExpiresAt: { $lt: now } }, '_id').lean();
  if (!stale.length) return;
  const ids = stale.map((row) => row._id);
  await BannerBooking.updateMany({ _id: { $in: ids }, status: S.PENDING_PAYMENT }, { $set: { status: S.EXPIRED, holdExpiresAt: null } });
  const expired = await BannerBooking.find({ _id: { $in: ids }, status: S.EXPIRED }, '_id').lean(); // a payment may have won the race
  await BannerSlotDay.deleteMany({ bookingId: { $in: expired.map((row) => row._id) } });
}

/** Slots a seller may rent, with the (anonymous) date ranges already taken. */
export async function listBookableSlots() {
  await releaseExpiredHolds();
  const slots = await BannerSlot.find({ enabled: true }).sort({ createdAt: 1, _id: 1 }).lean();
  const held = await BannerBooking.find({ slotId: { $in: slots.map((s) => s._id) }, status: { $in: HOLDING_STATUSES }, endsOn: { $gte: todayIst() } }, 'slotId startsOn endsOn').sort({ startsOn: 1 }).lean();
  return slots.map((slot) => serializeSlot(slot, {
    bookedRanges: held.filter((b) => String(b.slotId) === String(slot._id)).map(({ startsOn, endsOn }) => ({ startsOn, endsOn })),
  }));
}

export async function listDestinations(sellerId) {
  const [summaries, products] = await Promise.all([getSellerSummaries([sellerId]), listLiveProductOptions(sellerId)]);
  return { shop: { value: sellerId, label: summaries.get(sellerId)?.name ?? 'My shop' }, products };
}

async function resolveCreative(mediaId, kind, width, height, sellerId, field) {
  const asset = (await resolveMediaAssets([mediaId], { ownerId: sellerId, kinds: [kind] })).get(mediaId);
  if (!asset) throw new ValidationError('Upload the creative first.', { [field]: ['Upload this creative, then try again.'] });
  if (asset.width !== width || asset.height !== height) {
    throw new ValidationError('Wrong creative size.', { [field]: [`This slot needs a ${width} × ${height}px image${asset.width ? `; yours is ${asset.width} × ${asset.height}` : ''}.`] });
  }
  return { mediaId, key: asset.key, fileName: asset.fileName, width, height };
}

/** Holds the dates, prices the booking and opens the Razorpay order. The seller then pays and calls verify. */
export async function createBooking(sellerId, input, actor) {
  await releaseExpiredHolds();
  const slot = await BannerSlot.findById(input.placementId).lean();
  if (!slot?.enabled) throw new ValidationError('Slot unavailable.', { placementId: ['Choose an available slot.'] });

  const days = enumerateDays(input.startsOn, input.endsOn);
  if (!days) throw new ValidationError('Invalid dates.', { dateRange: ['Choose a valid date range.'] });
  if (input.startsOn < todayIst()) throw new ValidationError('Invalid dates.', { dateRange: ['The campaign cannot start in the past.'] });
  if (days.length > MAX_BOOKING_DAYS) throw new ValidationError('Invalid dates.', { dateRange: [`A booking can be at most ${MAX_BOOKING_DAYS} days.`] });

  const [summaries, products] = await Promise.all([getSellerSummaries([sellerId]), input.destinationType === 'PRODUCT' ? listLiveProductOptions(sellerId) : []]);
  const ownsDestination = input.destinationType === 'SHOP' ? input.destinationValue === sellerId : products.some((p) => p.value === input.destinationValue);
  if (!ownsDestination) throw new ValidationError('Invalid destination.', { destinationValue: ['Choose your own live shop or product.'] });

  const mobileCreative = await resolveCreative(input.mobileCreative.mediaId, 'BANNER_AD_MOBILE', slot.mobileWidth, slot.mobileHeight, sellerId, 'mobileCreative');

  const price = bannerAdPrice({ days: days.length, dailyRatePaise: slot.dailyRatePaise });
  const booking = new BannerBooking({
    sellerId,
    sellerName: summaries.get(sellerId)?.name ?? null,
    slotId: slot._id,
    slotName: slot.name,
    categoryId: slot.categoryId,
    categoryName: slot.categoryName,
    campaignName: input.campaignName,
    destinationType: input.destinationType,
    destinationValue: input.destinationValue,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    mobileCreative,
    ...price,
    holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
  });

  if (!(await lockDays(slot._id, days, booking._id))) throw slotBooked();
  try {
    const order = await paymentGateway.createPayment({
      amountPaise: price.totalPaise,
      receipt: `bad_${booking._id}`,
      notes: { bookingId: String(booking._id), sellerId },
    });
    booking.payment.providerOrderId = order.providerOrderId;
    await booking.save();
    await recordAudit({ action: 'ads.booking.create', subjectType: 'bannerBooking', subjectId: booking._id, after: serializeBooking(booking.toObject()), actor });
    return { booking: serializeBooking(booking.toObject()), payment: { ...order, bookingId: id(booking._id) } };
  } catch (error) {
    await BannerSlotDay.deleteMany({ bookingId: booking._id }); // a failed order must not keep the dates
    throw error;
  }
}

/**
 * Moves a booking to the admin queue once Razorpay confirms the money (checkout callback or webhook,
 * whichever lands first). Idempotent. A payment that arrives after the hold lapsed still wins its dates
 * if they are free; otherwise it is refunded in full.
 */
export async function confirmPayment(bookingId, providerPaymentId) {
  const booking = await BannerBooking.findById(bookingId).lean();
  if (!booking || [S.PENDING_REVIEW, S.APPROVED, S.REJECTED].includes(booking.status)) return booking;

  if (booking.status === S.EXPIRED) {
    const days = enumerateDays(booking.startsOn, booking.endsOn);
    if (booking.startsOn < todayIst() || !(await lockDays(booking.slotId, days, booking._id))) {
      await refundPayment(booking, providerPaymentId, `bad-late-${booking._id}`);
      return BannerBooking.findById(bookingId).lean();
    }
  }
  const now = new Date();
  const updated = await BannerBooking.findOneAndUpdate(
    { _id: bookingId, status: { $in: [S.PENDING_PAYMENT, S.EXPIRED] } },
    { $set: { status: S.PENDING_REVIEW, holdExpiresAt: null, submittedAt: now, 'payment.status': P.PAID, 'payment.providerPaymentId': providerPaymentId, 'payment.paidAt': now } },
    { new: true },
  ).lean();
  // A hint only (clients refetch over HTTP): tells open admin screens a request just entered the queue.
  if (updated) emitTo(rooms.admin, 'banner-ad:request', { id: id(updated._id), campaignName: updated.campaignName, sellerName: updated.sellerName });
  return updated ?? BannerBooking.findById(bookingId).lean();
}

async function refundPayment(booking, providerPaymentId, idempotencyKey) {
  const refund = await paymentGateway.refund({
    providerPaymentId,
    amountPaise: booking.totalPaise,
    notes: { bookingId: String(booking._id) },
    idempotencyKey,
  });
  await BannerBooking.updateOne(
    { _id: booking._id },
    { $set: { 'payment.status': P.REFUNDED, 'payment.providerPaymentId': providerPaymentId, 'payment.refundId': refund.providerRefundId } },
  );
}

/** Re-opens checkout for a booking whose dates are still held (e.g. the seller closed the payment window). */
export async function getPaymentOrder(sellerId, bookingId) {
  await releaseExpiredHolds();
  const booking = await BannerBooking.findOne({ _id: bookingId, sellerId, status: S.PENDING_PAYMENT }).lean();
  if (!booking) throw new ConflictError('NOT_PAYABLE', 'This booking can no longer be paid. Create a new one.');
  return { bookingId: id(booking._id), providerOrderId: booking.payment.providerOrderId, amountPaise: booking.totalPaise, currency: 'INR', keyId: env.RAZORPAY_KEY_ID };
}

/** The seller's checkout callback: trust only the signed result. */
export async function verifyBookingPayment(sellerId, bookingId, { providerPaymentId, signature }) {
  const booking = await BannerBooking.findOne({ _id: bookingId, sellerId }).lean();
  if (!booking) throw new NotFoundError('That banner request is not on your account.');
  if (!paymentGateway.verifyCheckout({ providerOrderId: booking.payment.providerOrderId, providerPaymentId, signature })) {
    throw new ValidationError('Payment could not be verified.', { signature: ['The payment signature is invalid.'] });
  }
  return serializeBooking(await confirmPayment(bookingId, providerPaymentId));
}

let webhooksRegistered = false;
/** Razorpay's payment.captured is the safety net when the seller pays but never returns to the app. */
export function registerBannerAdWebhooks() {
  if (webhooksRegistered) return;
  webhooksRegistered = true;
  registerWebhookHandler('RAZORPAY', 'payment.captured', 'bannerAd.paymentCaptured', async (receipt) => {
    const { payment } = paymentGateway.parseWebhook(receipt.payload);
    const booking = payment && (await BannerBooking.findOne({ 'payment.providerOrderId': payment.providerOrderId }, '_id totalPaise').lean());
    if (!booking || payment.amountPaise !== booking.totalPaise) return; // another payment kind, or a mismatched amount we must not honour
    await confirmPayment(booking._id, payment.providerPaymentId);
  });
}

/* ------------------------------------------------------------------ listing */

function pageMeta(page, pageSize, total, facets) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets };
}
const facetMap = (rows) => ({ status: Object.fromEntries(rows.map((row) => [row._id, row.count])) });

async function listBookings(base, { page, pageSize, q, status, sortField, sortDirection }) {
  const filter = {
    ...base,
    ...(q ? { $or: [{ campaignName: new RegExp(escapeRegex(q), 'i') }, { sellerName: new RegExp(escapeRegex(q), 'i') }] } : {}),
    ...(status.length ? { status: { $in: status } } : {}),
  };
  const [rows, total, facets] = await Promise.all([
    BannerBooking.find(filter).sort({ [sortField]: sortDirection, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    BannerBooking.countDocuments(filter),
    BannerBooking.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { data: rows.map(serializeBooking), meta: pageMeta(page, pageSize, total, facetMap(facets)) };
}

export async function listSellerBookings(sellerId, query) {
  await releaseExpiredHolds();
  return listBookings({ sellerId, status: { $ne: S.EXPIRED } }, query);
}

export async function getSellerBooking(sellerId, bookingId) {
  const row = await BannerBooking.findOne({ _id: bookingId, sellerId }).lean();
  if (!row) throw new NotFoundError('That banner request is not on your account.');
  return serializeBooking(row);
}

/** Admin review queue: only bookings the seller actually paid for. */
export const listAdminRequests = (query) => listBookings({ status: { $in: PAID_STATUSES } }, query);

/* ------------------------------------------------------------------ admin decision */

export async function decideBooking(bookingId, { decision, reason }, actor) {
  const now = new Date();
  const decided = { decidedAt: now, decidedBy: actor.userId };

  if (decision === 'APPROVED') {
    const approved = await BannerBooking.findOneAndUpdate({ _id: bookingId, status: S.PENDING_REVIEW }, { $set: { status: S.APPROVED, ...decided } }, { new: true }).lean();
    if (!approved) return alreadyDecidedOrMissing(bookingId);
    await recordAudit({ action: 'ads.review.approve', subjectType: 'bannerBooking', subjectId: bookingId, after: { status: S.APPROVED }, actor });
    emitTo(rooms.seller(approved.sellerId), 'banner-ad:updated', { id: id(approved._id), status: S.APPROVED });
    return serializeBooking(approved);
  }

  // Claim the rejection first (so two admins cannot both refund), free the dates, then refund.
  // A failed refund leaves REFUND_PENDING; deciding "reject" again retries just the refund.
  let booking = await BannerBooking.findOneAndUpdate(
    { _id: bookingId, status: S.PENDING_REVIEW },
    { $set: { status: S.REJECTED, rejectionReason: reason, 'payment.status': P.REFUND_PENDING, ...decided } },
    { new: true },
  ).lean();
  if (!booking) {
    const existing = await BannerBooking.findById(bookingId).lean();
    if (existing?.status === S.REJECTED && existing.payment.status === P.REFUND_PENDING) booking = existing;
    else return alreadyDecidedOrMissing(bookingId);
  }
  await BannerSlotDay.deleteMany({ bookingId: booking._id });
  await refundPayment(booking, booking.payment.providerPaymentId, `bad-refund-${booking._id}`);
  await recordAudit({ action: 'ads.review.reject', subjectType: 'bannerBooking', subjectId: bookingId, after: { status: S.REJECTED }, reason, actor });
  emitTo(rooms.seller(booking.sellerId), 'banner-ad:updated', { id: id(booking._id), status: S.REJECTED });
  return serializeBooking(await BannerBooking.findById(bookingId).lean());
}

async function alreadyDecidedOrMissing(bookingId) {
  if (!(await BannerBooking.exists({ _id: bookingId }))) throw new NotFoundError('That banner request no longer exists.');
  throw new ConflictError('ALREADY_DECIDED', 'This request has already been decided.');
}

/** Customer app: the paid banners running today on one page (a header category, or null = For You), in slot order. */
export async function listLiveAdBanners({ categoryId = null, today = todayIst() } = {}) {
  const rows = await BannerBooking.find({ status: S.APPROVED, categoryId, startsOn: { $lte: today }, endsOn: { $gte: today } }, 'mobileCreative campaignName destinationType destinationValue')
    .sort({ slotId: 1, _id: 1 })
    .lean();
  return rows.map((row) => ({
    id: id(row._id),
    imageUrl: deviceUrl(urlForKey(row.mobileCreative.key, 'PRODUCT_IMAGE')),
    altText: row.campaignName,
    target: { type: row.destinationType, id: row.destinationValue },
  }));
}
