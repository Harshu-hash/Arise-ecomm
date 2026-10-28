import { http as mswHttp } from 'msw';
import { findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  createClaim,
  disputePenalty,
  healthSummary,
  sellerClaims,
  sellerPenalties,
  sellerRatings,
  weeklyTrend,
} from '@seller/mocks/engine/sellerPerformance';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

export const sellerPerformanceHandlers = [
  mswHttp.get(`${SELLER_BASE}/performance/health`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(healthSummary(c.user.sellerId));
  }),

  mswHttp.get(`${SELLER_BASE}/performance/trend`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(weeklyTrend(c.user.sellerId));
  }),

  mswHttp.get(`${SELLER_BASE}/performance/ratings`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerRatings(c.user.sellerId));
  }),

  /* -------------------------------------------------------------- penalties */
  mswHttp.get(`${SELLER_BASE}/penalties`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-appliedAt' });
    const rows = sellerPenalties(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['orderId', 'violationLabel', 'id'],
      filterSpec: { status: 'status' },
      sortable: ['appliedAt', 'amountPaise'],
      facetFields: ['status'],
    });
    return okList(items, {
      ...meta,
      totals: { appliedPaise: rows.filter((p) => p.status === 'APPLIED').reduce((n, p) => n + p.amountPaise, 0) },
    });
  }),

  mswHttp.post(`${SELLER_BASE}/penalties/:id/dispute`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const penalty = findById('penalties', params.id);
    if (!penalty || penalty.sellerId !== c.user.sellerId) return notFound('That penalty is not on your account.');
    const body = await request.json().catch(() => ({}));
    const { error, penalty: updated } = disputePenalty(penalty, body?.reason);
    if (error) return conflict(error, 'DISPUTE_INVALID');
    scheduleSave();
    return ok(updated);
  }),

  /* ------------------------------------------------------------------ claims */
  mswHttp.get(`${SELLER_BASE}/claims`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-submittedAt' });
    const rows = sellerClaims(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['orderId', 'typeLabel', 'id'],
      filterSpec: { status: 'status', type: 'type' },
      sortable: ['submittedAt', 'amountClaimedPaise'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/claims/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const claim = findById('sellerClaims', params.id);
    if (!claim || claim.sellerId !== c.user.sellerId) return notFound('That claim is not on your account.');
    return ok(claim);
  }),

  mswHttp.post(`${SELLER_BASE}/claims`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, claim } = createClaim(c.seller, body);
    if (error) return badRequest(error, 'CLAIM_INVALID');
    scheduleSave();
    return created(claim);
  }),
];
