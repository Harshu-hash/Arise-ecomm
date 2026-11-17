import { http as mswHttp } from 'msw';
import { bannerAdDisplayStatus } from '@core/utils/bannerAds';
import { db, findById, update } from '../db/store';
import { guard } from '../engine/guard';
import { listResult, parseListQuery } from '../engine/list';
import { scheduleSave } from '../persistence';
import { conflict, notFound, ok, okList, validationFailed } from '../engine/respond';
import { mockNowIso } from '../engine/settings';

const BASE = '/api/admin/v1';
const row = (booking) => ({ ...booking, status: bannerAdDisplayStatus(booking) });

export const bannerAdHandlers = [
  mswHttp.get(`${BASE}/banner-ads/placements`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), ['ads.placement.view', 'ads.review.view']);
    if (g.response) return g.response;
    return ok(db.bannerAdPlacements);
  }),

  mswHttp.patch(`${BASE}/banner-ads/placements/:id`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'ads.placement.edit');
    if (g.response) return g.response;
    const placement = findById('bannerAdPlacements', params.id);
    if (!placement) return notFound('That banner placement no longer exists.');
    const body = await request.json();
    const dailyRatePaise = Number(body.dailyRatePaise);
    if (!Number.isInteger(dailyRatePaise) || dailyRatePaise <= 0) {
      return validationFailed({ dailyRatePaise: 'Enter a daily price greater than zero.' });
    }
    update('bannerAdPlacements', placement.id, { dailyRatePaise, enabled: body.enabled !== false, updatedAt: mockNowIso() });
    scheduleSave();
    return ok(findById('bannerAdPlacements', placement.id));
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
