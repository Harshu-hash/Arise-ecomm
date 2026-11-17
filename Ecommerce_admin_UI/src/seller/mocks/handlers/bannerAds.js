import { http as mswHttp } from 'msw';
import { db, findById, id, insert } from '@mocks/db/store';
import { bannerAdDisplayStatus, bannerAdPrice } from '@core/utils/bannerAds';
import { listResult, parseListQuery } from '@mocks/engine/list';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, created, notFound, ok, okList, unauthorized, validationFailed } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

function context(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

const ownBooking = (sellerId, bookingId) => {
  const booking = findById('bannerAdBookings', bookingId);
  return booking?.sellerId === sellerId ? booking : null;
};
const row = (booking) => ({ ...booking, status: bannerAdDisplayStatus(booking) });

export const sellerBannerAdHandlers = [
  mswHttp.get(`${SELLER_BASE}/banner-ads/placements`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    return ok(db.bannerAdPlacements.filter((placement) => placement.enabled));
  }),

  mswHttp.get(`${SELLER_BASE}/banner-ads/destinations`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    const productIds = new Set(db.offers.filter((offer) => offer.sellerId === c.user.sellerId && offer.status === 'LIVE').map((offer) => offer.productId));
    return ok({
      shop: { value: c.seller.id, label: c.seller.storeName },
      products: db.products.filter((product) => productIds.has(product.id) && product.status === 'LIVE').map((product) => ({ value: product.id, label: product.title })),
    });
  }),

  mswHttp.get(`${SELLER_BASE}/banner-ads`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-createdAt' });
    const result = listResult(db.bannerAdBookings.filter((booking) => booking.sellerId === c.user.sellerId).map(row), query, {
      searchFields: ['campaignName', 'id'], filterSpec: { status: 'status' }, sortable: ['createdAt', 'totalPaise', 'startsOn'], facetFields: ['status'],
    });
    return okList(result.items, result.meta);
  }),

  mswHttp.get(`${SELLER_BASE}/banner-ads/:id`, async ({ request, params }) => {
    const c = context(request);
    if (c.response) return c.response;
    const booking = ownBooking(c.user.sellerId, params.id);
    return booking ? ok(row(booking)) : notFound('That banner request is not on your account.');
  }),

  mswHttp.post(`${SELLER_BASE}/banner-ads`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    const body = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) return badRequest('An Idempotency-Key header is required.', 'IDEMPOTENCY_KEY_REQUIRED');
    const replay = db.idempotencyRecords.find((record) => record.sellerId === c.user.sellerId && record.operation === 'bannerAd.createAndPay' && record.key === idempotencyKey);
    if (replay) return ok(row(findById('bannerAdBookings', replay.resourceId)));
    const placement = findById('bannerAdPlacements', body.placementId);
    const errors = {};
    if (!body.campaignName?.trim()) errors.campaignName = 'Name this banner campaign.';
    if (!placement?.enabled) errors.placementId = 'Choose an available placement.';
    if (!['SHOP', 'PRODUCT'].includes(body.destinationType)) errors.destinationType = 'Choose where the banner should open.';
    if (!body.destinationValue) errors.destinationValue = 'Choose a destination.';
    if (!body.desktopCreative?.mediaId) errors.desktopCreative = 'Upload the desktop creative.';
    if (!body.mobileCreative?.mediaId) errors.mobileCreative = 'Upload the mobile creative.';
    const price = placement ? bannerAdPrice({ startsOn: body.startsOn, endsOn: body.endsOn, dailyRatePaise: placement.dailyRatePaise }) : null;
    if (!price) errors.dateRange = 'Choose a valid date range.';
    const today = new Date().toISOString().slice(0, 10);
    if (body.startsOn < today) errors.dateRange = 'The campaign cannot start in the past.';
    if (Object.keys(errors).length) return validationFailed(errors);

    const ownsDestination = body.destinationType === 'SHOP'
      ? body.destinationValue === c.user.sellerId
      : db.offers.some((offer) => offer.sellerId === c.user.sellerId && offer.productId === body.destinationValue && offer.status === 'LIVE');
    if (!ownsDestination) return validationFailed({ destinationValue: 'Choose your own live shop or product.' });

    const desktop = findById('mediaResources', body.desktopCreative.mediaId);
    const mobile = findById('mediaResources', body.mobileCreative.mediaId);
    if (desktop?.sellerId !== c.user.sellerId || mobile?.sellerId !== c.user.sellerId || desktop.status !== 'READY' || mobile.status !== 'READY') {
      return validationFailed({ creatives: 'Use creatives uploaded by this seller account.' });
    }

    const booking = insert('bannerAdBookings', {
      id: id('BAD', 5), sellerId: c.user.sellerId, sellerName: c.seller.storeName,
      campaignName: body.campaignName.trim(), placementId: placement.id, placementName: placement.name,
      destinationType: body.destinationType, destinationValue: body.destinationValue,
      startsOn: body.startsOn, endsOn: body.endsOn,
      desktopCreative: body.desktopCreative, mobileCreative: body.mobileCreative,
      ...price, status: 'PENDING_REVIEW', paymentStatus: 'PAID', paymentMethod: body.paymentMethod,
      paymentReference: `MOCK-PAY-${Date.now()}`, paidAt: mockNowIso(), submittedAt: mockNowIso(),
      rejectionReason: null, decidedAt: null, impressions: 0, clicks: 0, createdAt: mockNowIso(), version: 1,
    });
    insert('idempotencyRecords', { id: id('IDEM', 8), sellerId: c.user.sellerId, key: idempotencyKey, operation: 'bannerAd.createAndPay', resourceId: booking.id, createdAt: mockNowIso() });
    scheduleSave();
    return created(row(booking));
  }),
];
