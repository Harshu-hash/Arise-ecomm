import { db, filter, findById } from '@mocks/db/store';
import { computeSettlement } from '@mocks/engine/settlement';

/**
 * Seller-facing finance views over the shared finance collections. Every row
 * is the same `settlementLines` / `sellerPayouts` / `invoices` / `taxSummaries`
 * record the admin Finance screens compute from the shared `engine/settlement`,
 * filtered to the signed-in seller — so a seller's figures reconcile exactly
 * with the admin payout batch they belong to.
 */

/* ------------------------------------------------------------- settlements */

export function settlementRow(line) {
  const holdActions = {
    'A return is open on this item': 'Resolve the linked return before this line can be released.',
    'A claim is open against this seller': 'Respond to the open claim or wait for Seller Operations to decide it.',
    'Payouts are on hold for this seller': 'Complete the required account or bank verification shown in Settings.',
    'Return window is still open': 'This line releases automatically after the customer return window closes.',
  };
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
    requiredAction: line.holdReason ? (holdActions[line.holdReason] ?? 'Contact support with this settlement line ID.') : null,
    holdTimeline: line.holdReason ? [{ status: 'ON_HOLD', at: line.deliveredAt, reason: line.holdReason }, { status: 'AWAITING_ACTION', at: null, reason: holdActions[line.holdReason] ?? 'Review required' }] : [],
    settled: Boolean(line.payoutId),
    payoutId: line.payoutId,
    status: line.payoutId ? 'SETTLED' : line.eligible ? 'UPCOMING' : 'ON_HOLD',
  };
}

export function sellerSettlements(sellerId) {
  return filter('settlementLines', (l) => l.sellerId === sellerId).map(settlementRow);
}

export function sellerTransactions(sellerId) {
  const settlements = sellerSettlements(sellerId);
  const adjustments = filter('payoutAdjustments', (row) => row.sellerId === sellerId).map((row) => ({
    id: row.id, orderId: row.orderId ?? row.referenceId ?? row.id,
    productTitle: row.note, deliveredAt: row.raisedAt, paymentMethod: null, fulfillmentType: null,
    salePaise: 0, feesBeforeTaxPaise: 0, gstOnFeesPaise: 0, tcsPaise: 0, tdsPaise: 0,
    adjustmentsPaise: row.amountPaise, netPaise: row.amountPaise, negative: row.amountPaise < 0,
    status: row.batchId ? 'SETTLED' : 'UPCOMING', payoutId: row.batchId, transactionType: 'ADJUSTMENT',
    referenceType: row.referenceType, referenceId: row.referenceId,
  }));
  return [...settlements, ...adjustments];
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
    approvalStatus: batch?.status === 'PENDING_APPROVAL' ? 'AWAITING_SECOND_APPROVER' : batch?.approvedAt ? 'APPROVED' : 'NOT_REQUIRED',
    bankTransfer: {
      utr: payout.utr,
      utrStatus: payout.status === 'PAID' ? 'CONFIRMED' : payout.status === 'FAILED' ? 'RETURNED' : 'NOT_ISSUED',
      bankLast4: payout.bankLast4,
      maskedAccount: `••${payout.bankLast4}`,
      failureReason: payout.failureReason,
      correctionAction: payout.status === 'FAILED' ? { label: 'Correct and re-verify bank details', to: '/settings/bank' } : null,
      timeline: [
        { status: 'INCLUDED', label: 'Included in payout batch', at: batch?.createdAt ?? null },
        batch?.approvedAt && { status: 'APPROVED', label: 'Maker-checker approval completed', at: batch.approvedAt },
        batch?.releasedAt && { status: 'TRANSFER_INITIATED', label: 'Bank transfer initiated', at: batch.releasedAt },
        payout.paidAt && { status: 'BANK_CONFIRMED', label: 'Bank confirmed transfer', at: payout.paidAt },
        payout.status === 'FAILED' && { status: 'BANK_RETURNED', label: 'Bank returned transfer', at: batch?.releasedAt ?? null, reason: payout.failureReason },
      ].filter(Boolean),
    },
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

export function sellerFeeSchedule(sellerId) {
  const seller = findById('sellers', sellerId);
  const plan = db.commissionPlans.find((row) => row.key === seller?.commissionPlan) ?? db.commissionPlans.find((row) => row.key === 'STANDARD');
  const rules = db.commissionRules.map((rule) => ({ ...rule, sellerPlan: plan?.name ?? 'Standard', effectiveCommissionPct: Math.max(0, Number((rule.commissionPct + (plan?.adjustmentPct ?? 0)).toFixed(2))) }));
  const seeded = db.commissionRuleHistory.length ? db.commissionRuleHistory : rules.map((rule) => ({ id: `${rule.id}-current`, ruleId: rule.id, rootName: rule.rootName, band: rule.band, commissionPct: rule.effectiveCommissionPct, effectiveFrom: rule.effectiveFrom, effectiveTo: null, status: 'CURRENT' }));
  return { plan, rules, fees: findById('feeConfig', 'fees'), history: seeded };
}

export function previewSellerFees(sellerId, body) {
  const schedule = sellerFeeSchedule(sellerId);
  const salePaise = Number(body.salePaise);
  const rules = schedule.rules.filter((rule) => rule.rootName === body.rootName);
  const rule = rules.find((row) => salePaise >= row.minPaise && (row.maxPaise == null || salePaise <= row.maxPaise));
  return { ...computeSettlement({ salePaise, commissionPct: rule?.effectiveCommissionPct ?? 12, paymentMethod: body.paymentMethod ?? 'UPI', shippingFeePaise: Number(body.shippingFeePaise ?? 4200), fulfilledByArise: Boolean(body.fulfilledByArise), storageFeePaise: Number(body.storageFeePaise ?? 0) }), rule: rule ?? null };
}

export function sellerReconciliation(sellerId) {
  return sellerSettlements(sellerId).map((line) => {
    const raw = findById('settlementLines', line.id);
    const item = findById('orderItems', raw?.orderItemId);
    const payout = raw?.payoutId ? findById('sellerPayouts', raw.payoutId) : null;
    const returnRow = db.returns.find((row) => row.orderItemId === raw?.orderItemId) ?? null;
    const refund = returnRow?.refundId ? findById('refunds', returnRow.refundId) : null;
    const weightDispute = db.weightDisputes.find((row) => row.sellerId === sellerId && (row.shipmentId === item?.shipmentId || row.orderId === line.orderId)) ?? null;
    const adjustments = db.payoutAdjustments.filter((row) => row.sellerId === sellerId && (row.orderId === line.orderId || row.returnId === returnRow?.id || row.referenceId === weightDispute?.id));
    const disputes = db.financeDisputes.filter((row) => row.settlementLineId === line.id);
    const status = !line.eligible ? 'ON_HOLD' : payout?.status === 'FAILED' ? 'FAILED' : adjustments.length ? 'ADJUSTED' : payout ? 'MATCHED' : 'UNMATCHED';
    return {
      ...line, status, payout: payout ? payoutRow(payout) : null, return: returnRow, refund, weightDispute, adjustments, disputes,
      trace: [
        { type: 'ORDER_DELIVERED', id: line.orderId, at: line.deliveredAt, amountPaise: line.salePaise },
        returnRow && { type: 'RETURN', id: returnRow.id, at: returnRow.requestedAt, amountPaise: -returnRow.amountPaise },
        refund && { type: 'REFUND', id: refund.id, at: refund.initiatedAt, amountPaise: -refund.amountPaise },
        weightDispute && { type: 'WEIGHT_DISPUTE', id: weightDispute.id, at: weightDispute.createdAt ?? weightDispute.disputedAt, amountPaise: weightDispute.differencePaise ?? null },
        ...adjustments.map((row) => ({ type: 'ADJUSTMENT', id: row.id, at: row.raisedAt, amountPaise: row.amountPaise })),
        payout && { type: 'PAYOUT', id: payout.id, at: payout.paidAt, amountPaise: line.netPaise },
      ].filter(Boolean),
    };
  });
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
