import { http as mswHttp } from 'msw';
import { HOLDS_SLOT, bannerAdDisplayStatus } from '@core/utils/bannerAds';
import { db, findById, id, insert, remove, update } from '../db/store';
import { guard } from '../engine/guard';
import { listResult, parseListQuery } from '../engine/list';
import { scheduleSave } from '../persistence';
import { conflict, created, noContent, notFound, ok, okList, validationFailed } from '../engine/respond';
import { mockNowIso } from '../engine/settings';

const BASE = '/api/admin/v1';
const row = (booking) => ({ ...booking, status: bannerAdDisplayStatus(booking) });
const today = () => new Date().toISOString().slice(0, 10);
const holding = (placementId) => db.bannerAdBookings.filter((b) => b.placementId === placementId && HOLDS_SLOT.includes(b.status));
const withUsage = (placement) => ({
  ...placement,
  totalBookings: db.bannerAdBookings.filter((b) => b.placementId === placement.id).length,
  upcomingBookings: holding(placement.id).filter((b) => b.endsOn >= today()).length,
});

const SIZE_FIELDS = { mobileWidth: 'Banner width', mobileHeight: 'Banner height' };

/** Checks a whole slot definition; returns field errors (empty when valid). */
function slotErrors(slot) {
  const errors = {};
  if (!slot.name?.trim()) errors.name = 'Give the slot a name.';
  else if (db.bannerAdPlacements.some((other) => other.id !== slot.id && other.name.toLowerCase() === slot.name.trim().toLowerCase())) errors.name = 'Another slot already uses this name.';
  if (!Number.isInteger(slot.dailyRatePaise) || slot.dailyRatePaise <= 0) errors.dailyRatePaise = 'Enter a daily price greater than zero.';
  for (const [key, label] of Object.entries(SIZE_FIELDS)) {
    if (!Number.isInteger(slot[key]) || slot[key] < 100 || slot[key] > 4000) errors[key] = `${label} must be 100–4000 px.`;
  }
  return errors;
}
const pickSlot = (body) => ({
  name: body.name, description: body.description ?? '', dailyRatePaise: Number(body.dailyRatePaise),
  mobileWidth: Number(body.mobileWidth), mobileHeight: Number(body.mobileHeight), enabled: body.enabled !== false,
  categoryId: body.categoryId ?? null, categoryName: body.categoryId ? (db.categories.find((c) => c.id === body.categoryId)?.name ?? null) : null,
});

export const bannerAdHandlers = [
  mswHttp.get(`${BASE}/banner-ads/placements`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), ['ads.placement.view', 'ads.review.view']);
    if (g.response) return g.response;
    return ok(db.bannerAdPlacements.map(withUsage));
  }),

  mswHttp.post(`${BASE}/banner-ads/placements`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'ads.placement.edit');
    if (g.response) return g.response;
    const slot = pickSlot(await request.json());
    const errors = slotErrors(slot);
    if (Object.keys(errors).length) return validationFailed(errors);
    const placement = insert('bannerAdPlacements', { id: id('BAP', 3), ...slot, name: slot.name.trim(), updatedAt: mockNowIso(), version: 1 });
    scheduleSave();
    return created(withUsage(placement));
  }),

  mswHttp.patch(`${BASE}/banner-ads/placements/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'ads.placement.edit');
    if (g.response) return g.response;
    const placement = findById('bannerAdPlacements', params.id);
    if (!placement) return notFound('That banner slot no longer exists.');
    // A price or size change applies to new bookings only; existing ones keep their snapshot.
    const slot = { ...placement, ...pickSlot({ ...placement, ...(await request.json()) }) };
    const errors = slotErrors(slot);
    if (Object.keys(errors).length) return validationFailed(errors);
    update('bannerAdPlacements', placement.id, { ...slot, name: slot.name.trim(), updatedAt: mockNowIso(), version: (placement.version ?? 1) + 1 });
    scheduleSave();
    return ok(withUsage(findById('bannerAdPlacements', placement.id)));
  }),

  mswHttp.delete(`${BASE}/banner-ads/placements/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'ads.placement.edit');
    if (g.response) return g.response;
    const placement = findById('bannerAdPlacements', params.id);
    if (!placement) return notFound('That banner slot no longer exists.');
    if (db.bannerAdBookings.some((b) => b.placementId === placement.id)) {
      return conflict('This slot has bookings, so it cannot be deleted. Turn off "Available for booking" instead.', 'SLOT_HAS_BOOKINGS');
    }
    remove('bannerAdPlacements', placement.id);
    scheduleSave();
    return noContent();
  }),

  mswHttp.get(`${BASE}/banner-ads/requests`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'ads.review.view');
    if (g.response) return g.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-submittedAt' });
    const result = listResult(db.bannerAdBookings.map(row), query, {
      searchFields: ['campaignName', 'sellerName', 'id'],
      filterSpec: { status: 'status' },
      sortable: ['submittedAt', 'totalPaise', 'startsOn'],
      facetFields: ['status'],
    });
    return okList(result.items, result.meta);
  }),

  mswHttp.post(`${BASE}/banner-ads/requests/:id/decide`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'ads.review.decide');
    if (g.response) return g.response;
    const booking = findById('bannerAdBookings', params.id);
    if (!booking) return notFound('That banner request no longer exists.');
    if (booking.status !== 'PENDING_REVIEW') return conflict('This request has already been decided.', 'ALREADY_DECIDED');
    const body = await request.json();
    if (!['APPROVED', 'REJECTED'].includes(body.decision)) return validationFailed({ decision: 'Choose approve or reject.' });
    if (body.decision === 'REJECTED' && !body.reason?.trim()) return validationFailed({ reason: 'Tell the seller why the banner was rejected.' });
    const overlap = body.decision === 'APPROVED' && db.bannerAdBookings.some((other) => (
      other.id !== booking.id && other.placementId === booking.placementId && other.status === 'APPROVED'
      && other.startsOn <= booking.endsOn && other.endsOn >= booking.startsOn
    ));
    if (overlap) return conflict('Another approved banner already occupies this placement during the selected dates.', 'PLACEMENT_BOOKED');
    update('bannerAdBookings', booking.id, {
      status: body.decision,
      rejectionReason: body.decision === 'REJECTED' ? body.reason.trim() : null,
      decidedAt: mockNowIso(),
      decidedByName: g.user.name,
      paymentStatus: body.decision === 'REJECTED' ? 'REFUNDED' : booking.paymentStatus,
      refundReference: body.decision === 'REJECTED' ? `MOCK-REF-${booking.id}` : null,
    });
    scheduleSave();
    return ok(row(findById('bannerAdBookings', booking.id)));
  }),
];
