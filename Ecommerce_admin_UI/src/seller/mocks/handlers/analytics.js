import { http as mswHttp } from 'msw';
import { filter, findById, update } from '@mocks/db/store';
import { writeAudit } from '@mocks/engine/audit';
import { badRequest, notFound, ok, unauthorized } from '@mocks/engine/respond';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { analyticsFilters, analyticsView } from '@seller/mocks/engine/sellerAnalytics';
import { SELLER_BASE } from './auth';

function ctx(request) { const result = resolveCaller(request); return result.error ? { response: unauthorized() } : result; }

export const sellerAnalyticsHandlers = [
  mswHttp.get(`${SELLER_BASE}/analytics/filters`, async ({ request }) => { const c = ctx(request); return c.response ?? ok(analyticsFilters(c.user.sellerId)); }),
  mswHttp.get(`${SELLER_BASE}/analytics/recommendations`, async ({ request }) => { const c = ctx(request); if (c.response) return c.response; return ok(filter('sellerRecommendations', (row) => row.sellerId === c.user.sellerId)); }),
  mswHttp.post(`${SELLER_BASE}/analytics/recommendations/:id/:action`, async ({ request, params }) => {
    const c = ctx(request); if (c.response) return c.response;
    const row = findById('sellerRecommendations', params.id); if (!row || row.sellerId !== c.user.sellerId) return notFound('Recommendation not found.');
    if (!['apply', 'dismiss', 'snooze'].includes(params.action)) return badRequest('Choose apply, dismiss or snooze.', 'ACTION_INVALID');
    const body = await request.json().catch(() => ({})); const status = params.action === 'apply' ? 'APPLIED' : params.action === 'dismiss' ? 'DISMISSED' : 'SNOOZED';
    const patch = { status, updatedAt: mockNowIso(), outcome: params.action === 'apply' ? (body.outcome ?? 'Seller accepted the recommended action.') : params.action === 'dismiss' ? (body.reason ?? 'Dismissed by seller.') : null, snoozedUntil: params.action === 'snooze' ? (body.until ?? new Date(mockNow() + 7 * 86400_000).toISOString()) : null };
    update('sellerRecommendations', row.id, patch); writeAudit({ actor: c.user, action: `recommendation.${params.action}`, entityType: 'sellerRecommendation', entityId: row.id, entityLabel: row.title, reason: body.reason, metadata: { sellerId: c.user.sellerId, targetType: row.targetType, targetId: row.targetId } }); scheduleSave(); return ok(findById('sellerRecommendations', row.id));
  }),
  mswHttp.get(`${SELLER_BASE}/analytics/:view`, async ({ request, params }) => { const c = ctx(request); if (c.response) return c.response; if (!['overview', 'products', 'traffic', 'operations', 'finance'].includes(params.view)) return notFound('Analytics view not found.'); return ok(analyticsView(c.user.sellerId, params.view, new URL(request.url).searchParams)); }),
];
