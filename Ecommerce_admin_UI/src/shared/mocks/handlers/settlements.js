import { fakerEN_IN as faker } from '@faker-js/faker';
import { http as mswHttp } from 'msw';
import { db, filter, findById, id, insert, update } from '../db/store';
import { writeAudit } from '../engine/audit';
import { guard } from '../engine/guard';
import { listResult, parseListQuery } from '../engine/list';
import {
  badRequest,
  conflict,
  notFound,
  ok,
  okList,
  validationFailed,
} from '../engine/respond';
import { mockNow, mockNowIso } from '../engine/settings';
import { settlementEligibility } from '../engine/settlement';
import {
  DEDUCTION_FIELDS,
  PAYOUT_MODE,
  SETTLEMENT_STATE,
  isReturnOpen,
  settledPaise,
} from '../engine/settlementFlow';
import { enrichSettlement } from '../engine/settlementView';
import { scheduleSave } from '../persistence';

const BASE = '/api/admin/v1';

/**
 * Per-order-item seller settlements (the payout flow). The admin pays a seller
 * for one delivered item, but only after that item's category return window has
 * closed and no return, claim or hold stands in the way. Money is recomputed
 * from the settlement line every time; the admin only enters deductions and
 * records how the money was sent.
 */

/** A seller the caller is scoped to see. */
function sellerAllowed(sellerId, user) {
  const scope = user.scope?.sellers;
  return !scope?.length || scope.includes(sellerId);
}

/** Pays one line: creates a per-line payout and locks the settled amount. */
function payLine(line, { mode, txnNo, bulkRef = '' }, actor) {
  const settled = settledPaise(line);
  const seller = findById('sellers', line.sellerId);
  const invoiceNo = `ARS/STL/${new Date().getFullYear()}/${String(line.id).replace(/\D/g, '').slice(-6)}`;
  const utr = mode === PAYOUT_MODE.AUTOMATIC ? `UTR${faker.string.numeric(12)}` : '';

  const payout = insert('sellerPayouts', {
    id: id('PYO', 6),
    batchId: null,
    bulkRef,
    sellerId: line.sellerId,
    sellerName: line.sellerName,
    orderId: line.orderId,
    orderItemId: line.orderItemId,
    lineCount: 1,
    grossPaise: line.salePaise,
    feesPaise: line.feesBeforeTaxPaise,
    gstOnFeesPaise: line.gstOnFeesPaise,
    tcsPaise: line.tcsPaise,
    tdsPaise: line.tdsPaise,
    adjustmentsPaise: 0,
    netPaise: settled,
    carriedForward: false,
    status: 'PAID',
    mode,
    txnNo: txnNo || '',
    utr,
    invoiceNo,
    failureReason: null,
    bankLast4: seller ? faker.string.numeric(4) : '0000',
    paidAt: mockNowIso(),
    version: 1,
  });

  update('settlementLines', line.id, {
    reviewed: true,
    payoutId: payout.id,
    settledAt: mockNowIso(),
    settledPaise: settled,
    invoiceNo,
    txnNo: txnNo || '',
    utr,
    mode,
    bulkRef,
    payoutState: SETTLEMENT_STATE.SETTLED,
    failureReason: null,
    eligible: false,
    holdReason: 'Settled',
  });

  writeAudit({
    actor, action: 'settlement.pay', entityType: 'settlementLine', entityId: line.id,
    entityLabel: line.productTitle, metadata: { orderId: line.orderId, sellerId: line.sellerId, settledPaise: settled, mode, bulkRef },
  });
  return payout;
}

/** A readiness view of a line, payable means every check green and not settled. */
function payableView(line, now) {
  const v = enrichSettlement(line, now);
  return { v, payable: v.ready && !v.settled };
}

/** Next bulk settlement reference, BS-YYMM-NNN. */
function nextBulkRef() {
  const now = new Date(mockNow());
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(db.sellerBulkSettlements.length + 1).padStart(3, '0');
  return `BS-${yymm}-${seq}`;
}

export const settlementHandlers = [
  /* ------------------------------------------------------- summary tiles */
  mswHttp.get(`${BASE}/settlements/summary`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    if (g.response) return g.response;
    const now = mockNow();
    const rows = db.settlementLines
      .filter((l) => sellerAllowed(l.sellerId, g.user))
      .map((l) => enrichSettlement(l, now));

    const sum = (pred, field = 'settledPaise') => rows.filter(pred).reduce((n, r) => n + r[field], 0);
    const count = (pred) => rows.filter(pred).length;
    const payable = (r) => r.state === SETTLEMENT_STATE.READY || r.state === SETTLEMENT_STATE.REVIEWED;

    return ok({
      total: rows.length,
      payableCount: count(payable),
      payablePaise: sum(payable),
      inWindowCount: count((r) => r.state === SETTLEMENT_STATE.WINDOW_OPEN),
      inWindowPaise: sum((r) => r.state === SETTLEMENT_STATE.WINDOW_OPEN),
      heldCount: count((r) => r.state === SETTLEMENT_STATE.HELD),
      settledCount: count((r) => r.state === SETTLEMENT_STATE.SETTLED),
      settledPaise: sum((r) => r.state === SETTLEMENT_STATE.SETTLED),
      failedCount: count((r) => r.state === SETTLEMENT_STATE.FAILED),
    });
  }),

  /* ------------------------------------------------------------ the list */
  mswHttp.get(`${BASE}/settlements`, async ({ request }) => {
    const url = new URL(request.url);
    const g = await guard(request, url, 'finance.payout.view');
    if (g.response) return g.response;

    const now = mockNow();
    const query = parseListQuery(url, { defaultSort: '-deliveredAt' });
    const rows = db.settlementLines
      .filter((l) => sellerAllowed(l.sellerId, g.user))
      .map((l) => enrichSettlement(l, now));

    const result = listResult(rows, query, {
      searchFields: ['id', 'orderId', 'sellerName', 'productTitle', 'sku', 'customerName'],
      filterSpec: {
        state: 'state',
        sellerId: 'sellerId',
        paymentMethod: 'paymentMethod',
        fulfillmentType: 'fulfillmentType',
        reviewed: { path: 'reviewed', kind: 'boolean' },
        deliveredAt: { path: 'deliveredAt', kind: 'date' },
      },
      sortable: ['deliveredAt', 'salePaise', 'settledPaise', 'netPaise'],
      facetFields: ['state'],
    });
    return okList(result.items, result.meta);
  }),

  /* ============================ bulk settlement ============================ */
  /* Sellers that have payable items waiting. */
  mswHttp.get(`${BASE}/settlements/bulk/sellers`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    if (g.response) return g.response;
    const now = mockNow();
    const bySeller = new Map();
    for (const line of db.settlementLines) {
      if (!sellerAllowed(line.sellerId, g.user)) continue;
      const { payable, v } = payableView(line, now);
      if (!payable) continue;
      const cur = bySeller.get(line.sellerId) ?? { id: line.sellerId, shopName: line.sellerName, payableCount: 0, payablePaise: 0 };
      cur.payableCount += 1;
      cur.payablePaise += v.settledPaise;
      bySeller.set(line.sellerId, cur);
    }
    return ok({ items: [...bySeller.values()].sort((a, b) => b.payablePaise - a.payablePaise) });
  }),

  /* One seller's payable items for selection. */
  mswHttp.get(`${BASE}/settlements/bulk/sellers/:sellerId/lines`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    if (g.response) return g.response;
    const now = mockNow();
    const rows = db.settlementLines
      .filter((l) => l.sellerId === params.sellerId && sellerAllowed(l.sellerId, g.user))
      .map((l) => enrichSettlement(l, now))
      .filter((r) => r.ready && !r.settled)
      .sort((a, b) => new Date(a.deliveredAt) - new Date(b.deliveredAt));
    const seller = findById('sellers', params.sellerId);
    return ok({ sellerId: params.sellerId, sellerName: seller?.storeName ?? rows[0]?.sellerName ?? '', items: rows });
  }),

  /* Bulk settlement history. */
  mswHttp.get(`${BASE}/settlements/bulk`, async ({ request }) => {
    const url = new URL(request.url);
    const g = await guard(request, url, 'finance.payout.view');
    if (g.response) return g.response;
    const query = parseListQuery(url, { defaultSort: '-createdAt' });
    const rows = db.sellerBulkSettlements.filter((b) => sellerAllowed(b.sellerId, g.user));
    const result = listResult(rows, query, {
      searchFields: ['refNo', 'sellerName'],
      filterSpec: { status: 'status', sellerId: 'sellerId' },
      sortable: ['createdAt', 'totalPaise', 'orderCount'],
      facetFields: ['status'],
    });
    return okList(result.items, result.meta);
  }),

  /* Preview a bulk selection (one seller, ready items only). */
  mswHttp.post(`${BASE}/settlements/bulk/preview`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const body = await request.json().catch(() => ({}));
    if (!body.sellerId) return validationFailed({ sellerId: 'Choose a seller.' });
    if (!Array.isArray(body.lineIds) || !body.lineIds.length) return validationFailed({ lineIds: 'Select at least one item.' });
    const now = mockNow();
    const rows = body.lineIds.map((lid) => findById('settlementLines', lid)).filter(Boolean).map((l) => enrichSettlement(l, now));
    if (rows.some((r) => r.sellerId !== body.sellerId)) return conflict('A bulk settlement must be for a single seller.', 'MIXED_SELLERS');
    const ready = rows.filter((r) => r.ready && !r.settled);
    return ok({
      sellerId: body.sellerId,
      sellerName: rows[0]?.sellerName ?? '',
      rows,
      readyCount: ready.length,
      notReadyCount: rows.length - ready.length,
      totalPaise: ready.reduce((n, r) => n + r.settledPaise, 0),
    });
  }),

  /* Pay a bulk selection under one shared reference (BS-YYMM-NNN). */
  mswHttp.post(`${BASE}/settlements/bulk/pay`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const body = await request.json().catch(() => ({}));
    if (!body.sellerId) return validationFailed({ sellerId: 'Choose a seller.' });
    if (!Array.isArray(body.lineIds) || !body.lineIds.length) return validationFailed({ lineIds: 'Select at least one item.' });
    const now = mockNow();
    const lines = body.lineIds.map((lid) => findById('settlementLines', lid)).filter(Boolean);
    if (lines.some((l) => l.sellerId !== body.sellerId)) return conflict('A bulk settlement must be for a single seller.', 'MIXED_SELLERS');

    // Reject the whole request if any selected item is not ready or already paid.
    const notReady = lines.filter((l) => !payableView(l, now).payable);
    if (notReady.length) {
      return conflict(`Not ready to settle: ${notReady.map((l) => l.orderId).join(', ')}`, 'NOT_READY');
    }
    const mode = body.mode === PAYOUT_MODE.MANUAL ? PAYOUT_MODE.MANUAL : PAYOUT_MODE.AUTOMATIC;
    if (mode === PAYOUT_MODE.MANUAL && !String(body.txnNo ?? '').trim()) {
      return validationFailed({ txnNo: 'Enter the UPI/bank transaction number for a manual bulk payout.' });
    }

    const refNo = nextBulkRef();
    const seller = findById('sellers', body.sellerId);
    let settledCount = 0;
    let totalPaise = 0;
    const results = lines.map((line) => {
      const payout = payLine(line, { mode, txnNo: body.txnNo, bulkRef: refNo }, g.user);
      settledCount += 1;
      totalPaise += payout.netPaise;
      return { lineId: line.id, orderId: line.orderId, productTitle: line.productTitle, status: SETTLEMENT_STATE.SETTLED, settledPaise: payout.netPaise };
    });

    const bulk = insert('sellerBulkSettlements', {
      id: id('BLK', 5),
      refNo,
      sellerId: body.sellerId,
      sellerName: seller?.storeName ?? lines[0]?.sellerName ?? '',
      orderCount: lines.length,
      settledCount,
      failedCount: 0,
      totalPaise,
      status: 'COMPLETED',
      mode,
      txnNo: body.txnNo || '',
      createdByName: g.user.name,
      createdAt: mockNowIso(),
      settledAt: mockNowIso(),
      lines: results,
      version: 1,
    });
    writeAudit({ actor: g.user, action: 'settlement.bulk_pay', entityType: 'sellerBulkSettlement', entityId: bulk.id, entityLabel: refNo, metadata: { sellerId: body.sellerId, orderCount: lines.length, totalPaise, mode } });
    scheduleSave();
    return ok(bulk);
  }),

  /* One bulk settlement by its reference. */
  mswHttp.get(`${BASE}/settlements/bulk/:refNo`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    if (g.response) return g.response;
    const bulk = db.sellerBulkSettlements.find((b) => b.refNo === params.refNo);
    if (!bulk || !sellerAllowed(bulk.sellerId, g.user)) return notFound('That bulk settlement no longer exists.');
    return ok(bulk);
  }),

  /* ---------------------------------------------------------- one detail */
  mswHttp.get(`${BASE}/settlements/:lineId`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line || !sellerAllowed(line.sellerId, g.user)) return notFound('That settlement no longer exists.');

    const detail = enrichSettlement(line, mockNow());
    const seller = findById('sellers', line.sellerId);
    const order = findById('orders', line.orderId);
    detail.orderMoney = {
      salePaise: line.salePaise,
      commissionPaise: line.commissionPaise,
      feesBeforeTaxPaise: line.feesBeforeTaxPaise,
      gstOnFeesPaise: line.gstOnFeesPaise,
      tcsPaise: line.tcsPaise,
      tdsPaise: line.tdsPaise,
      paymentMethod: line.paymentMethod,
    };
    detail.seller = { id: seller?.id, name: seller?.storeName, upiId: seller?.upiId ?? '', payoutOnHold: Boolean(seller?.payoutOnHold) };
    detail.address = order?.address?.state ?? null;
    return ok(detail);
  }),

  /* ---------------------------------------------------- set deductions */
  mswHttp.patch(`${BASE}/settlements/:lineId/issues`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.adjust');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line) return notFound('That settlement no longer exists.');
    if (line.settledAt) return conflict('This settlement is already paid and locked.', 'ALREADY_SETTLED');

    const body = await request.json().catch(() => ({}));
    const input = body.issues ?? body ?? {};
    const deductions = {};
    for (const [k] of DEDUCTION_FIELDS) deductions[k] = Math.max(0, Math.round(Number(input[k]) || 0));
    update('settlementLines', line.id, { deductions });
    scheduleSave();
    return ok(enrichSettlement(findById('settlementLines', line.id), mockNow()));
  }),

  /* -------------------------------------------------------- mark reviewed */
  mswHttp.post(`${BASE}/settlements/:lineId/review`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line) return notFound('That settlement no longer exists.');
    if (line.settledAt) return conflict('This settlement is already paid.', 'ALREADY_SETTLED');

    update('settlementLines', line.id, { reviewed: true });
    writeAudit({ actor: g.user, action: 'settlement.review', entityType: 'settlementLine', entityId: line.id, entityLabel: line.productTitle });
    scheduleSave();
    return ok(enrichSettlement(findById('settlementLines', line.id), mockNow()));
  }),

  /* ------------------------------------------------------------------ pay */
  mswHttp.post(`${BASE}/settlements/:lineId/pay`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line || !sellerAllowed(line.sellerId, g.user)) return notFound('That settlement no longer exists.');
    if (line.settledAt) return ok(enrichSettlement(line, mockNow())); // idempotent

    const detail = enrichSettlement(line, mockNow());
    if (!detail.ready) return conflict('Every readiness check must be green before paying.', 'NOT_READY');

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === PAYOUT_MODE.MANUAL ? PAYOUT_MODE.MANUAL : PAYOUT_MODE.AUTOMATIC;
    if (mode === PAYOUT_MODE.MANUAL && !String(body.txnNo ?? '').trim()) {
      return validationFailed({ txnNo: 'Enter the UPI/bank transaction number for a manual payout.' });
    }
    if (!(settledPaise(line) > 0)) return badRequest('The settled amount must be positive.');

    // Persist any deductions sent alongside the pay request.
    if (body.issues) {
      const deductions = {};
      for (const [k] of DEDUCTION_FIELDS) deductions[k] = Math.max(0, Math.round(Number(body.issues[k]) || 0));
      update('settlementLines', line.id, { deductions });
    }
    const payout = payLine(findById('settlementLines', line.id), { mode, txnNo: body.txnNo }, g.user);
    scheduleSave();
    return ok({ ...enrichSettlement(findById('settlementLines', line.id), mockNow()), payoutId: payout.id });
  }),

  /* --------------------------------------------------------- retry failed */
  mswHttp.post(`${BASE}/settlements/:lineId/retry`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line) return notFound('That settlement no longer exists.');
    if (line.settledAt) return ok(enrichSettlement(line, mockNow()));
    if (line.payoutState !== SETTLEMENT_STATE.FAILED) return conflict('This settlement has not failed.', 'NOTHING_TO_RETRY');

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === PAYOUT_MODE.MANUAL ? PAYOUT_MODE.MANUAL : PAYOUT_MODE.AUTOMATIC;
    const payout = payLine(line, { mode, txnNo: body.txnNo }, g.user);
    scheduleSave();
    return ok({ ...enrichSettlement(findById('settlementLines', line.id), mockNow()), payoutId: payout.id });
  }),

  /* --------------------------------------------------- release a line hold */
  mswHttp.post(`${BASE}/settlements/:lineId/release-hold`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.hold');
    if (g.response) return g.response;
    const line = findById('settlementLines', params.lineId);
    if (!line) return notFound('That settlement no longer exists.');
    update('settlementLines', line.id, { manualHold: false, manualHoldReason: null, payoutState: null });
    writeAudit({ actor: g.user, action: 'settlement.release_hold', entityType: 'settlementLine', entityId: line.id, entityLabel: line.productTitle });
    scheduleSave();
    return ok(enrichSettlement(findById('settlementLines', line.id), mockNow()));
  }),

  /* --------------------------------------- seller-wide payout hold (kept) */
  mswHttp.post(`${BASE}/sellers/:sellerId/payout-hold`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.hold');
    if (g.response) return g.response;
    const body = await request.json().catch(() => ({}));
    const seller = findById('sellers', params.sellerId);
    if (!seller) return notFound('That seller no longer exists.');
    if (!body.reason?.trim()) return validationFailed({ reason: 'A reason is required.' });
    const onHold = Boolean(body.onHold);
    if (seller.payoutOnHold === onHold) {
      return conflict(onHold ? 'Payouts are already on hold.' : 'Payouts are not on hold.', 'NO_CHANGE');
    }
    update('sellers', seller.id, { payoutOnHold: onHold, payoutHoldReason: onHold ? body.reason : null });
    // Recompute eligibility of the seller's unsettled lines from source truth.
    for (const line of filter('settlementLines', (l) => l.sellerId === seller.id && !l.settledAt)) {
      const item = findById('orderItems', line.orderItemId);
      const returnOpen = isReturnOpen(db.returns, line.orderItemId);
      const claimOpen = db.sellerClaims.some(
        (c) => c.sellerId === seller.id && ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(c.status),
      );
      const next = settlementEligibility(item ?? { status: 'DELIVERED' }, { returnOpen, claimOpen, sellerOnHold: onHold, now: mockNow() });
      update('settlementLines', line.id, { eligible: next.eligible, holdReason: next.reason });
    }
    writeAudit({ actor: g.user, action: 'payout.hold', entityType: 'seller', entityId: seller.id, entityLabel: seller.storeName, reason: body.reason, metadata: { onHold } });
    scheduleSave();
    return ok({ id: seller.id, payoutOnHold: onHold });
  }),

  /* --------------------------- seller deduction disputes (reconciliation) */
  mswHttp.post(`${BASE}/finance-disputes/:id/resolve`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.recon.resolve');
    if (g.response) return g.response;
    const dispute = findById('financeDisputes', params.id);
    if (!dispute) return notFound('That finance dispute no longer exists.');
    if (['RESOLVED', 'REJECTED'].includes(dispute.status)) return conflict('This dispute has already been resolved.', 'ALREADY_RESOLVED');
    const body = await request.json().catch(() => ({}));
    if (!['APPROVE', 'REJECT'].includes(body.decision)) return validationFailed({ decision: 'Approve or reject the dispute.' });
    if (!String(body.reason ?? '').trim()) return validationFailed({ reason: 'Explain the resolution to the seller.' });
    let adjustment = null;
    if (body.decision === 'APPROVE') {
      const line = findById('settlementLines', dispute.settlementLineId);
      const seller = findById('sellers', dispute.sellerId);
      adjustment = insert('payoutAdjustments', { id: id('ADJ', 5), sellerId: dispute.sellerId, sellerName: seller?.storeName ?? line?.sellerName, type: 'DEDUCTION_DISPUTE_REVERSAL', amountPaise: dispute.disputedPaise, note: `Approved deduction dispute ${dispute.id}`, referenceType: 'FINANCE_DISPUTE', referenceId: dispute.id, orderId: dispute.orderId, status: 'APPROVED', batchId: null, raisedByName: g.user.name, raisedAt: mockNowIso(), approvedByName: g.user.name, version: 1 });
    }
    update('financeDisputes', dispute.id, { status: body.decision === 'APPROVE' ? 'RESOLVED' : 'REJECTED', approvalStatus: body.decision === 'APPROVE' ? 'APPROVED' : 'NOT_REQUIRED', resolution: body.reason.trim(), resolvedAt: mockNowIso(), resolvedByName: g.user.name, payoutAdjustmentId: adjustment?.id ?? null, timeline: [...(dispute.timeline ?? []), { status: body.decision === 'APPROVE' ? 'RESOLVED' : 'REJECTED', at: mockNowIso(), actorName: g.user.name, note: body.reason.trim() }] });
    writeAudit({ actor: g.user, action: 'finance.recon.resolve', entityType: 'financeDispute', entityId: dispute.id, entityLabel: dispute.id, reason: body.reason, metadata: { decision: body.decision, adjustmentId: adjustment?.id } });
    scheduleSave();
    return ok(findById('financeDisputes', dispute.id));
  }),
];
