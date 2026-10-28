import { db, filter, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';

/**
 * Seller account health, penalties and SPF claims over the shared `sellers`,
 * `penalties`, `sellerClaims` and `reviews` collections — the same data the
 * admin "Performance & SLA", Penalties and Seller Claims screens read, so the
 * numbers a seller sees are never a second, disagreeing copy.
 */

const WEIGHTS = { cancellation: 3, lateDispatch: 2, returns: 1, defect: 2 };

function metricStatus(value, warn, bad) {
  if (value >= bad) return 'BAD';
  if (value >= warn) return 'WARNING';
  return 'GOOD';
}

/** Defect rate: the share of reviews rating 1–2 stars among delivered items. */
function defectRate(sellerId) {
  const myItemIds = new Set(filter('orderItems', (i) => i.sellerId === sellerId).map((i) => i.id));
  const reviews = filter('reviews', (r) => myItemIds.has(r.orderItemId));
  if (!reviews.length) return 0;
  const bad = reviews.filter((r) => r.rating <= 2).length;
  return Number(((bad / reviews.length) * 100).toFixed(2));
}

export function healthSummary(sellerId) {
  const seller = findById('sellers', sellerId);
  const defect = defectRate(sellerId);
  const metrics = [
    { key: 'cancellation', label: 'Order cancellation rate', value: seller?.cancellationPct ?? 0, warn: 2, bad: 5, weight: WEIGHTS.cancellation },
    { key: 'lateDispatch', label: 'Late dispatch rate', value: seller?.lateDispatchPct ?? 0, warn: 3, bad: 8, weight: WEIGHTS.lateDispatch },
    { key: 'returns', label: 'Return rate', value: seller?.returnPct ?? 0, warn: 8, bad: 15, weight: WEIGHTS.returns },
    { key: 'defect', label: 'Negative review rate', value: defect, warn: 10, bad: 20, weight: WEIGHTS.defect },
  ].map((m) => ({ ...m, status: metricStatus(m.value, m.warn, m.bad) }));

  const deduction = metrics.reduce((n, m) => n + m.value * m.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - deduction)));

  const activePenalties = filter('penalties', (p) => p.sellerId === sellerId && p.status === 'APPLIED');
  const openClaims = filter('sellerClaims', (c) => c.sellerId === sellerId && ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(c.status));

  return {
    score,
    tier: score >= 85 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 50 ? 'AT_RISK' : 'CRITICAL',
    metrics,
    rating: seller?.rating ?? null,
    activePenaltyCount: activePenalties.length,
    activePenaltyPaise: activePenalties.reduce((n, p) => n + p.amountPaise, 0),
    openClaimCount: openClaims.length,
  };
}

/** 8 weekly points for cancellation/late-dispatch rate, from real orders. */
export function weeklyTrend(sellerId) {
  const items = filter('orderItems', (i) => i.sellerId === sellerId);
  const ordersById = new Map(db.orders.map((o) => [o.id, o]));
  const shipmentsById = new Map(filter('shipments', (s) => s.sellerId === sellerId).map((s) => [s.id, s]));
  const weeks = [];

  for (let w = 7; w >= 0; w -= 1) {
    const end = mockNow() - w * 7 * 86400_000;
    const start = end - 7 * 86400_000;
    const weekItems = items.filter((i) => {
      const order = ordersById.get(i.orderId);
      if (!order) return false;
      const t = new Date(order.placedAt).getTime();
      return t >= start && t < end;
    });
    const total = weekItems.length || 1;
    const cancelled = weekItems.filter((i) => i.status === 'CANCELLED' && i.cancelledBy === 'SELLER').length;
    const lateDispatched = weekItems.filter((i) => {
      const shipment = shipmentsById.get(i.shipmentId);
      const order = ordersById.get(i.orderId);
      if (!shipment?.lastScanAt || !order) return false;
      return new Date(shipment.lastScanAt).getTime() > new Date(order.placedAt).getTime() + 2 * 86400_000;
    }).length;

    weeks.push({
      week: new Date(end).toISOString().slice(0, 10),
      cancellationPct: Number(((cancelled / total) * 100).toFixed(1)),
      lateDispatchPct: Number(((lateDispatched / total) * 100).toFixed(1)),
      orders: weekItems.length,
    });
  }
  return weeks;
}

export function sellerRatings(sellerId) {
  const myItemIds = new Set(filter('orderItems', (i) => i.sellerId === sellerId).map((i) => i.id));
  const reviews = filter('reviews', (r) => myItemIds.has(r.orderItemId)).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  const avg = reviews.length ? Number((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(2)) : null;
  return { average: avg, count: reviews.length, distribution, recent: reviews.slice(0, 20) };
}

/* ------------------------------------------------------------- penalties */

export function penaltyRow(p) {
  return { ...p, canDispute: p.status === 'APPLIED' };
}

export function sellerPenalties(sellerId) {
  return filter('penalties', (p) => p.sellerId === sellerId).map(penaltyRow);
}

export function disputePenalty(penalty, reason) {
  if (penalty.status !== 'APPLIED') return { error: 'Only an applied penalty can be disputed.' };
  if (!String(reason ?? '').trim()) return { error: 'Explain why you are disputing this penalty.' };
  update('penalties', penalty.id, { status: 'DISPUTED', disputeReason: reason });
  return { penalty: penaltyRow(findById('penalties', penalty.id)) };
}

/* ----------------------------------------------------------------- claims */

export function sellerClaims(sellerId) {
  return filter('sellerClaims', (c) => c.sellerId === sellerId);
}

const CLAIM_TYPES = [
  ['RETURN_DAMAGED', 'Return received damaged or used'],
  ['WRONG_ITEM_RETURNED', 'Customer returned a different item'],
  ['LOST_IN_TRANSIT', 'Shipment lost by the courier'],
  ['LOST_IN_WAREHOUSE', 'Lost or damaged in an Arise warehouse'],
  ['WEIGHT_DISPUTE', 'Courier charged for a higher weight'],
];
export const CLAIM_TYPE_OPTIONS = CLAIM_TYPES.map(([value, label]) => ({ value, label }));

export function createClaim(seller, body) {
  const type = CLAIM_TYPES.find(([code]) => code === body?.type);
  if (!type) return { error: 'Choose what went wrong.' };
  const amount = Math.round(Number(body?.amountClaimed) * 100);
  if (!amount || amount <= 0) return { error: 'Enter the amount you are claiming.' };
  if (!String(body?.orderId ?? '').trim()) return { error: 'Enter the order ID this claim is about.' };
  if (!String(body?.evidence ?? '').trim()) return { error: 'Describe the evidence you have.' };

  const claim = insert('sellerClaims', {
    id: id('CLM', 6),
    sellerId: seller.id,
    sellerName: seller.storeName,
    type: type[0],
    typeLabel: type[1],
    orderId: body.orderId,
    amountClaimedPaise: amount,
    amountApprovedPaise: null,
    status: 'SUBMITTED',
    submittedAt: mockNowIso(),
    evidence: [body.evidence],
    decisionReason: null,
    version: 1,
  });
  return { claim };
}
