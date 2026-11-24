import { filter, findById } from '@mocks/db/store';

/**
 * A unified recent-activity feed for the seller dashboard, in the same shape
 * `@ui/components/ActivityTimeline` already renders for the admin panel —
 * reusing that component rather than inventing a seller-only one. Events are
 * drawn from across the shared order and listing collections, so the
 * feed is a real cross-section of what has actually happened on the account,
 * not a single table's log.
 *
 * `actorType` must be one of the timeline's known tones (system / customer /
 * seller / courier) for the actor name to pick up its colour; `actorId` just
 * gates whether an avatar is shown at all ('system' hides it).
 */
export function recentActivity(sellerId, limit = 12) {
  const myOrderItemIds = new Set(filter('orderItems', (i) => i.sellerId === sellerId).map((i) => i.id));

  const events = [];

  for (const e of filter('orderEvents', (ev) => myOrderItemIds.has(ev.itemId))) {
    const actorType = e.actorType === 'SYSTEM' ? 'system' : e.actorType === 'COURIER' ? 'courier' : 'seller';
    events.push({
      id: e.id,
      at: e.at,
      title: `Order ${findById('orderItems', e.itemId)?.orderId ?? ''} → ${e.status.replaceAll('_', ' ')}`,
      actorName: e.actorName,
      actorType,
      actorId: actorType,
      severity: e.status === 'CANCELLED' ? 'warning' : undefined,
    });
  }

  for (const s of filter('listingSubmissions', (sub) => sub.sellerId === sellerId && sub.decidedAt)) {
    events.push({
      id: `qc-${s.id}`,
      at: s.decidedAt,
      title: `${s.productTitle} — QC ${s.status === 'DONE' ? 'approved' : s.status.replaceAll('_', ' ').toLowerCase()}`,
      actorName: s.decidedByName ?? 'Catalog team',
      actorType: 'system',
      actorId: 'system',
      severity: s.status === 'NEEDS_CHANGES' ? 'warning' : undefined,
    });
  }

  for (const p of filter('penalties', (x) => x.sellerId === sellerId)) {
    events.push({
      id: `pen-${p.id}`,
      at: p.appliedAt,
      title: `Penalty applied — ${p.violationLabel}`,
      actorName: 'Arise Trust & Safety',
      actorType: 'system',
      actorId: 'system',
      severity: 'error',
    });
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}
