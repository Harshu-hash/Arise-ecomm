import { filter, findById } from '@mocks/db/store';

/**
 * Seller-facing finance views over the shared finance collections. Every row
 * is the same `settlementLines` / `sellerPayouts` / `invoices` / `taxSummaries`
 * record the admin Finance screens compute from the shared `engine/settlement`,
 * filtered to the signed-in seller — so a seller's figures reconcile exactly
 * with the admin payout batch they belong to.
 */

/* ------------------------------------------------------------- settlements */

export function settlementRow(line) {
  return {
    id: line.id,
    orderId: line.orderId,
    orderItemId: line.orderItemId,
    productTitle: line.productTitle,
    sku: line.sku,
    deliveredAt: line.deliveredAt,
    paymentMethod: line.paymentMethod,
    fulfillmentType: line.fulfillmentType,
    salePaise: line.salePaise,
    commissionPaise: line.commissionPaise,
    commissionPct: line.commissionPct,
    closingFeePaise: line.closingFeePaise,
    collectionFeePaise: line.collectionFeePaise,
    shippingFeePaise: line.shippingFeePaise,
    pickPackFeePaise: line.pickPackFeePaise,
    storageFeePaise: line.storageFeePaise,
    feesBeforeTaxPaise: line.feesBeforeTaxPaise,
    gstOnFeesPaise: line.gstOnFeesPaise,
    tcsPaise: line.tcsPaise,
    tdsPaise: line.tdsPaise,
    adjustmentsPaise: line.adjustmentsPaise,
    netPaise: line.netPaise,
    negative: line.negative,
    eligible: line.eligible,
    holdReason: line.holdReason,
    settled: Boolean(line.payoutId),
    payoutId: line.payoutId,
    status: line.payoutId ? 'SETTLED' : line.eligible ? 'UPCOMING' : 'ON_HOLD',
  };
}

export function sellerSettlements(sellerId) {
  return filter('settlementLines', (l) => l.sellerId === sellerId).map(settlementRow);
}

/* ---------------------------------------------------------------- payouts */

export function payoutRow(payout) {
  const batch = findById('payoutBatches', payout.batchId);
  return {
    id: payout.id,
    batchId: payout.batchId,
    periodStart: batch?.periodStart ?? null,
    periodEnd: batch?.periodEnd ?? null,
    batchStatus: batch?.status ?? null,
    lineCount: payout.lineCount,
    grossPaise: payout.grossPaise,
    feesPaise: payout.feesPaise,
    gstOnFeesPaise: payout.gstOnFeesPaise,
    tcsPaise: payout.tcsPaise,
    tdsPaise: payout.tdsPaise,
    adjustmentsPaise: payout.adjustmentsPaise,
    netPaise: payout.netPaise,
    carriedForward: payout.carriedForward,
    status: payout.status,
    utr: payout.utr,
    failureReason: payout.failureReason,
    bankLast4: payout.bankLast4,
    paidAt: payout.paidAt,
  };
}

export function sellerPayouts(sellerId) {
  return filter('sellerPayouts', (p) => p.sellerId === sellerId).map(payoutRow);
}

/* --------------------------------------------------------------- invoices */

export function sellerInvoices(sellerId) {
  return filter('invoices', (inv) => inv.sellerId === sellerId);
}

export function sellerTaxSummaries(sellerId) {
  return filter('taxSummaries', (t) => t.sellerId === sellerId);
}

/* ------------------------------------------------------------ dashboard */

export function financeSummary(sellerId) {
  const lines = filter('settlementLines', (l) => l.sellerId === sellerId);
  const payouts = filter('sellerPayouts', (p) => p.sellerId === sellerId);

  const unsettledEligible = lines.filter((l) => l.eligible && !l.payoutId);
  const held = lines.filter((l) => !l.eligible);
  const sum = (arr, key) => arr.reduce((n, x) => n + (x[key] ?? 0), 0);

  // Group held amounts by reason so the dashboard can explain the hold.
  const holdByReason = {};
  for (const l of held) {
    const k = l.holdReason ?? 'On hold';
    holdByReason[k] = (holdByReason[k] ?? 0) + l.netPaise;
  }

  return {
    nextPayoutPaise: sum(unsettledEligible, 'netPaise'),
    nextPayoutLines: unsettledEligible.length,
    onHoldPaise: sum(held, 'netPaise'),
    onHoldLines: held.length,
    holdReasons: Object.entries(holdByReason).map(([reason, paise]) => ({ reason, paise })),
    paidPaise: sum(payouts.filter((p) => p.status === 'PAID'), 'netPaise'),
    inProcessPaise: sum(payouts.filter((p) => ['INCLUDED', 'PROCESSING'].includes(p.status)), 'netPaise'),
    failedPaise: sum(payouts.filter((p) => p.status === 'FAILED'), 'netPaise'),
    lifetimeGrossPaise: sum(lines, 'salePaise'),
    lifetimeNetPaise: sum(lines, 'netPaise'),
    lifetimeCommissionPaise: sum(lines, 'commissionPaise'),
    lifetimeFeesPaise: sum(lines, 'feesBeforeTaxPaise') + sum(lines, 'gstOnFeesPaise'),
    lifetimeTaxPaise: sum(lines, 'tcsPaise') + sum(lines, 'tdsPaise'),
    deliveredItems: lines.length,
  };
}
