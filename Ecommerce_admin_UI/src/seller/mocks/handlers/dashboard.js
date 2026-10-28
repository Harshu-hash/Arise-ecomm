import { http as mswHttp } from 'msw';
import { findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { ok, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import { markAlertRead, visibleAlerts } from '@seller/mocks/engine/sellerAlerts';
import { recentActivity } from '@seller/mocks/engine/sellerActivity';
import { SELLER_BASE } from './auth';

/**
 * Seller home snapshot. Phase S1 reads the headline metrics straight off the
 * seller record (already seeded with 30-day GMV, orders, rating and SLA
 * rates); later phases replace these with live rollups over the shared orders,
 * listings and settlement collections.
 */
export const sellerDashboardHandlers = [
  mswHttp.get(`${SELLER_BASE}/dashboard/summary`, ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const seller = sellerFor(user) ?? findById('sellers', user.sellerId);

    const ordersToProcess = Math.round((seller?.orders30d ?? 0) * 0.04);
    const returnsPending = Math.round((seller?.orders30d ?? 0) * ((seller?.returnPct ?? 0) / 100) * 0.3);

    return ok({
      store: { name: seller?.storeName ?? user.storeName, tier: seller?.tier ?? 'BRONZE', rating: seller?.rating ?? null },
      kpis: {
        gmv30dPaise: seller?.gmv30dPaise ?? 0,
        orders30d: seller?.orders30d ?? 0,
        liveListings: seller?.liveListings ?? 0,
        ordersToProcess,
        returnsPending,
        payoutDuePaise: Math.round((seller?.gmv30dPaise ?? 0) * 0.12),
      },
      accountHealth: {
        score: Math.max(0, Math.round(100 - (seller?.cancellationPct ?? 0) * 3 - (seller?.lateDispatchPct ?? 0) * 2)),
        cancellationPct: seller?.cancellationPct ?? 0,
        lateDispatchPct: seller?.lateDispatchPct ?? 0,
        returnPct: seller?.returnPct ?? 0,
      },
      tips: [
        { id: 'tip-ads', title: 'Boost visibility with Sponsored Products', cta: 'Create a campaign', link: '/ads/new' },
        { id: 'tip-stock', title: 'Keep best-sellers in stock to avoid lost sales', cta: 'Review inventory', link: '/inventory' },
        { id: 'tip-listings', title: 'Add more listings to reach more buyers', cta: 'Add a product', link: '/listings/new' },
      ],
    });
  }),

  mswHttp.get(`${SELLER_BASE}/dashboard/activity`, ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    return ok(recentActivity(user.sellerId));
  }),

  /** The header bell — low stock, SLA breaches, failed payouts, penalties… */
  mswHttp.get(`${SELLER_BASE}/dashboard/alerts`, ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const { alerts, unread } = visibleAlerts(user.sellerId);
    return ok(alerts, { unread });
  }),

  mswHttp.post(`${SELLER_BASE}/dashboard/alerts/:key/read`, ({ request, params }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const seller = sellerFor(user) ?? findById('sellers', user.sellerId);
    markAlertRead(seller, params.key);
    scheduleSave();
    return ok({ ok: true });
  }),
];
