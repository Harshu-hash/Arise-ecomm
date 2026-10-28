import { filter, findById, update } from '@mocks/db/store';
import { mockNow } from '@mocks/engine/settings';

/**
 * Derived alerts for the seller header bell — the seller-side counterpart to
 * the admin dashboard's `/dashboard/alerts`. Nothing here is stored as a row;
 * each alert is computed fresh from live conditions (low stock, an SLA
 * breach, a failed payout…) and keyed stably so "mark read" can persist
 * which ones a seller has already seen, on the seller record itself.
 */

function alert(key, { title, body, at, severity = 'info', link }) {
  return { id: key, title, body, at, severity, link };
}

export function computeAlerts(sellerId) {
  const out = [];

  // Low stock on live FBA inventory.
  for (const inv of filter('inventory', (i) => i.sellerId === sellerId)) {
    const available = inv.sellable - inv.reserved;
    if (available > 0 && available < (inv.lowStockThreshold ?? 20)) {
      out.push(alert(`low-stock:${inv.id}`, {
        title: 'Running low on stock',
        body: `${inv.productTitle} (${inv.sku}) — only ${available} left to sell.`,
        at: new Date(mockNow() - 2 * 3600_000).toISOString(),
        severity: 'warning',
        link: '/inventory',
      }));
    }
  }

  // Orders overdue to dispatch.
  for (const shipment of filter('shipments', (s) => s.sellerId === sellerId && s.fulfillmentType !== 'ARISE')) {
    if (!['PLACED', 'ACCEPTED', 'PACKED', 'MANIFESTED'].includes(shipment.status)) continue;
    const order = findById('orders', shipment.orderId);
    if (!order) continue;
    const dueAt = new Date(order.placedAt).getTime() + 24 * 3600_000;
    if (dueAt < mockNow()) {
      out.push(alert(`sla:${shipment.id}`, {
        title: 'An order is overdue to dispatch',
        body: `Order ${order.id} is past its dispatch SLA — ship it to protect your account health.`,
        at: new Date(dueAt).toISOString(),
        severity: 'error',
        link: `/orders/${shipment.id}`,
      }));
    }
  }

  // Failed payouts.
  for (const payout of filter('sellerPayouts', (p) => p.sellerId === sellerId && p.status === 'FAILED')) {
    out.push(alert(`payout:${payout.id}`, {
      title: 'A payout failed',
      body: payout.failureReason ?? 'Update your bank details so the next attempt succeeds.',
      at: new Date(mockNow() - 6 * 3600_000).toISOString(),
      severity: 'error',
      link: '/payments',
    }));
  }

  // Applied penalties still open.
  for (const p of filter('penalties', (x) => x.sellerId === sellerId && x.status === 'APPLIED')) {
    out.push(alert(`penalty:${p.id}`, {
      title: 'A penalty was applied',
      body: `${p.violationLabel} — dispute it if you believe this is wrong.`,
      at: p.appliedAt,
      severity: 'warning',
      link: '/performance/penalties',
    }));
  }

  // Ad campaigns rejected in review.
  for (const c of filter('adCampaigns', (x) => x.sellerId === sellerId && x.status === 'REJECTED')) {
    out.push(alert(`campaign:${c.id}`, {
      title: 'A campaign was rejected',
      body: c.rejectReason ?? 'Review and resubmit your campaign.',
      at: c.createdAt,
      severity: 'warning',
      link: `/ads/${c.id}`,
    }));
  }

  // Tickets waiting on the seller's reply.
  for (const t of filter('tickets', (x) => x.requesterType === 'SELLER' && x.sellerId === sellerId && x.status === 'PENDING_INTERNAL')) {
    out.push(alert(`ticket:${t.id}`, {
      title: 'Support replied to your ticket',
      body: t.subject,
      at: t.createdAt,
      severity: 'info',
      link: `/support/${t.id}`,
    }));
  }

  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function visibleAlerts(sellerId) {
  const seller = findById('sellers', sellerId);
  const dismissed = new Set(seller?.dismissedAlertKeys ?? []);
  const all = computeAlerts(sellerId);
  const alerts = all.map((a) => ({ ...a, read: dismissed.has(a.id) }));
  return { alerts, unread: alerts.filter((a) => !a.read).length };
}

export function markAlertRead(seller, alertKey) {
  const dismissed = new Set(seller.dismissedAlertKeys ?? []);
  dismissed.add(alertKey);
  update('sellers', seller.id, { dismissedAlertKeys: Array.from(dismissed) });
}
