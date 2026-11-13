import { http as mswHttp } from 'msw';
import { HttpResponse } from 'msw';
import { filter, findById, id, insert, update } from '@mocks/db/store';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized, validationFailed } from '@mocks/engine/respond';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { enrichSettlement, buildSettlementInvoice } from '@mocks/engine/settlementView';
import { scheduleSave } from '@mocks/persistence';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import {
  financeSummary,
  payoutRow,
  sellerInvoices,
  sellerPayouts,
  sellerSettlements,
  sellerTransactions,
  sellerTaxSummaries,
  settlementRow,
  previewSellerFees,
  sellerFeeSchedule,
  sellerReconciliation,
} from '@seller/mocks/engine/sellerFinance';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user };
}

export const sellerFinanceHandlers = [
  /* --------------------------------- per-order-item settlements (payouts) */
  mswHttp.get(`${SELLER_BASE}/settlements/mine`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const now = mockNow();
    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: '-deliveredAt' });
    const rows = filter('settlementLines', (l) => l.sellerId === c.user.sellerId).map((l) => enrichSettlement(l, now));
    const result = listResult(rows, query, {
      searchFields: ['id', 'orderId', 'productTitle', 'sku', 'customerName'],
      filterSpec: { state: 'state', fulfillmentType: 'fulfillmentType' },
      sortable: ['deliveredAt', 'quotedPaise', 'settledPaise'],
      facetFields: ['state'],
    });
    return okList(result.items, result.meta);
  }),

  mswHttp.get(`${SELLER_BASE}/settlements/:lineId/invoice`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const line = findById('settlementLines', params.lineId);
    if (!line || line.sellerId !== c.user.sellerId) return notFound('That settlement no longer exists.');
    if (!line.settledAt) return conflict('This settlement is not paid yet, so it has no invoice.', 'NOT_SETTLED');
    return ok(buildSettlementInvoice(line));
  }),

  /* ---------------------------------------------------------- dashboard */
  mswHttp.get(`${SELLER_BASE}/finance/summary`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(financeSummary(c.user.sellerId));
  }),

  /* ------------------------------------------------------------- payouts */
  mswHttp.get(`${SELLER_BASE}/finance/payouts`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: '-periodEnd' });
    let rows = sellerPayouts(c.user.sellerId);
    if (url.searchParams.get('from')) rows = rows.filter((row) => row.periodEnd >= url.searchParams.get('from'));
    if (url.searchParams.get('to')) rows = rows.filter((row) => row.periodStart <= `${url.searchParams.get('to')}T23:59:59.999Z`);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['id', 'utr'],
      filterSpec: { status: 'status' },
      sortable: ['periodEnd', 'netPaise'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/finance/payouts/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const payout = findById('sellerPayouts', params.id);
    if (!payout || payout.sellerId !== c.user.sellerId) return notFound('That payout is not on your account.');
    const lines = filter('settlementLines', (l) => l.payoutId === payout.id).map(settlementRow);
    const adjustments = filter('payoutAdjustments', (row) => payout.batchId && row.batchId === payout.batchId && row.sellerId === c.user.sellerId);
    const adjustmentLines = adjustments.map((row) => ({ id: row.id, orderId: row.orderId ?? row.referenceId ?? row.id, productTitle: row.note, salePaise: 0, feesBeforeTaxPaise: 0, gstOnFeesPaise: 0, tcsPaise: 0, tdsPaise: 0, adjustmentsPaise: row.amountPaise, netPaise: row.amountPaise, transactionType: 'ADJUSTMENT', referenceType: row.referenceType, referenceId: row.referenceId }));
    const documents = filter('financeDocuments', (row) => row.sellerId === c.user.sellerId && row.entityType === 'PAYOUT' && row.entityId === payout.id);
    return ok({ ...payoutRow(payout), lines: [...lines, ...adjustmentLines], adjustments, documents, reconciliationTotalPaise: [...lines, ...adjustmentLines].reduce((sum, row) => sum + row.netPaise, 0) });
  }),

  /* ----------------------------------------------------- reconciliation */
  mswHttp.get(`${SELLER_BASE}/finance/reconciliation`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    let rows = sellerReconciliation(c.user.sellerId);
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (status && status !== 'all') rows = rows.filter((row) => row.status === status);
    if (from) rows = rows.filter((row) => row.deliveredAt >= from);
    if (to) rows = rows.filter((row) => row.deliveredAt <= `${to}T23:59:59.999Z`);
    const query = parseListQuery(url, { defaultSort: '-deliveredAt' });
    const result = listResult(rows, query, { searchFields: ['id', 'orderId', 'productTitle'], filterSpec: { status: 'status' }, sortable: ['deliveredAt', 'salePaise', 'netPaise'], facetFields: ['status'] });
    return okList(result.items, { ...result.meta, counts: Object.fromEntries(['MATCHED', 'UNMATCHED', 'ON_HOLD', 'FAILED', 'ADJUSTED'].map((key) => [key, rows.filter((row) => row.status === key).length])) });
  }),

  mswHttp.get(`${SELLER_BASE}/finance/reconciliation/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = sellerReconciliation(c.user.sellerId).find((item) => item.id === params.id);
    return row ? ok(row) : notFound('That reconciliation line is not on your account.');
  }),

  mswHttp.post(`${SELLER_BASE}/finance/reconciliation/:id/disputes`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const line = findById('settlementLines', params.id);
    if (!line || line.sellerId !== c.user.sellerId) return notFound('That settlement line is not on your account.');
    if (filter('financeDisputes', (row) => row.settlementLineId === line.id && !['REJECTED', 'RESOLVED'].includes(row.status)).length) return conflict('An open dispute already exists for this deduction.', 'DISPUTE_ALREADY_OPEN');
    const body = await request.json();
    if (!String(body?.reason ?? '').trim() || !(body?.evidenceMediaIds?.length)) return validationFailed({ evidence: 'Give a reason and attach durable evidence.' });
    const disputedPaise = Number(body.disputedPaise);
    if (!Number.isInteger(disputedPaise) || disputedPaise <= 0) return validationFailed({ disputedPaise: 'Enter the positive deduction amount being disputed.' });
    const dispute = insert('financeDisputes', { id: id('FDP', 6), sellerId: c.user.sellerId, settlementLineId: line.id, orderId: line.orderId, payoutId: line.payoutId, reasonCode: body.reasonCode ?? 'OTHER_DEDUCTION', reason: body.reason.trim(), disputedPaise, evidenceMediaIds: body.evidenceMediaIds, status: 'UNDER_REVIEW', approvalStatus: 'NOT_REQUIRED', createdAt: mockNowIso(), resolvedAt: null, resolution: null, payoutAdjustmentId: null, timeline: [{ status: 'UNDER_REVIEW', at: mockNowIso(), actorName: c.user.name, note: body.reason.trim() }], version: 1 });
    scheduleSave();
    return created(dispute);
  }),

  /* --------------------------------------------------------- fee schedule */
  mswHttp.get(`${SELLER_BASE}/finance/fees`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerFeeSchedule(c.user.sellerId));
  }),

  mswHttp.post(`${SELLER_BASE}/finance/fees/preview`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    if (!Number.isInteger(Number(body.salePaise)) || Number(body.salePaise) <= 0) return badRequest('Enter a positive sale amount in paise.', 'SALE_AMOUNT_INVALID');
    return ok(previewSellerFees(c.user.sellerId, body));
  }),

  /* --------------------------------------------------------- documents */
  mswHttp.get(`${SELLER_BASE}/finance/documents`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    let rows = filter('financeDocuments', (row) => row.sellerId === c.user.sellerId);
    if (url.searchParams.get('entityType')) rows = rows.filter((row) => row.entityType === url.searchParams.get('entityType'));
    if (url.searchParams.get('entityId')) rows = rows.filter((row) => row.entityId === url.searchParams.get('entityId'));
    return ok(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),

  mswHttp.post(`${SELLER_BASE}/finance/documents`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const allowed = ['TAX_INVOICE', 'CREDIT_NOTE', 'PAYOUT_ADVICE', 'SETTLEMENT_STATEMENT', 'GST_CERTIFICATE', 'TCS_CERTIFICATE', 'TDS_CERTIFICATE', 'COD_REMITTANCE_STATEMENT'];
    if (!allowed.includes(body.kind)) return badRequest('Choose a supported finance document.', 'DOCUMENT_KIND_INVALID');
    const ownedEntity = body.entityType === 'INVOICE'
      ? filter('invoices', (row) => row.id === body.entityId && row.sellerId === c.user.sellerId)[0]
      : body.entityType === 'PAYOUT'
        ? filter('sellerPayouts', (row) => row.id === body.entityId && row.sellerId === c.user.sellerId)[0]
        : body.entityType === 'TAX_SUMMARY'
          ? filter('taxSummaries', (row) => row.id === body.entityId && row.sellerId === c.user.sellerId)[0]
          : null;
    if (!ownedEntity) return notFound('That finance source record is not on your account.');
    const existing = filter('financeDocuments', (row) => row.sellerId === c.user.sellerId && row.entityType === body.entityType && row.entityId === body.entityId && row.kind === body.kind).at(-1);
    if (existing?.status === 'READY') return ok(existing);
    const document = insert('financeDocuments', { id: id('FDOC', 7), sellerId: c.user.sellerId, entityType: body.entityType, entityId: body.entityId, kind: body.kind, fileName: `${body.kind.toLowerCase()}-${body.entityId}.pdf`, status: body.simulateFailure ? 'FAILED' : 'READY', failureReason: body.simulateFailure ? 'Document renderer was temporarily unavailable.' : null, downloadUrl: body.simulateFailure ? null : `${SELLER_BASE}/finance/documents/pending/download`, createdAt: mockNowIso(), generatedAt: body.simulateFailure ? null : mockNowIso(), retryCount: 0, version: 1 });
    document.downloadUrl = document.status === 'READY' ? `${SELLER_BASE}/finance/documents/${document.id}/download` : null;
    scheduleSave();
    return created(document);
  }),

  mswHttp.post(`${SELLER_BASE}/finance/documents/:id/retry`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const document = findById('financeDocuments', params.id);
    if (!document || document.sellerId !== c.user.sellerId) return notFound('That finance document is not on your account.');
    if (document.status !== 'FAILED') return conflict('Only a failed document can be retried.', 'DOCUMENT_NOT_FAILED');
    update('financeDocuments', document.id, { status: 'READY', failureReason: null, generatedAt: mockNowIso(), downloadUrl: `${SELLER_BASE}/finance/documents/${document.id}/download`, retryCount: document.retryCount + 1 });
    scheduleSave();
    return ok(findById('financeDocuments', document.id));
  }),

  mswHttp.get(`${SELLER_BASE}/finance/documents/:id/download`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const document = findById('financeDocuments', params.id);
    if (!document || document.sellerId !== c.user.sellerId) return notFound('That finance document is not on your account.');
    if (document.status !== 'READY') return conflict('The document is not ready to download.', 'DOCUMENT_NOT_READY');
    return new HttpResponse(`Arise ${document.kind}\nDocument ${document.id}\nEntity ${document.entityType}:${document.entityId}`, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${document.fileName}"` } });
  }),

  /* -------------------------------------------------------- transactions */
  mswHttp.get(`${SELLER_BASE}/finance/transactions`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: '-deliveredAt' });
    let rows = sellerSettlements(c.user.sellerId);
    if (url.searchParams.get('from')) rows = rows.filter((row) => row.deliveredAt >= url.searchParams.get('from'));
    if (url.searchParams.get('to')) rows = rows.filter((row) => row.deliveredAt <= `${url.searchParams.get('to')}T23:59:59.999Z`);
    const tab = url.searchParams.get('tab');
    if (tab && tab !== 'all') rows = rows.filter((r) => r.status === tab);

    const { items, meta } = listResult(rows, query, {
      searchFields: ['orderId', 'productTitle', 'id'],
      filterSpec: { status: 'status', fulfillmentType: 'fulfillmentType', paymentMethod: 'paymentMethod' },
      sortable: ['deliveredAt', 'salePaise', 'netPaise'],
      facetFields: ['status'],
    });
    const all = sellerSettlements(c.user.sellerId);
    return okList(items, {
      ...meta,
      counts: {
        UPCOMING: all.filter((r) => r.status === 'UPCOMING').length,
        SETTLED: all.filter((r) => r.status === 'SETTLED').length,
        ON_HOLD: all.filter((r) => r.status === 'ON_HOLD').length,
      },
    });
  }),

  mswHttp.get(`${SELLER_BASE}/finance/adjustments`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerTransactions(c.user.sellerId).filter((row) => row.transactionType === 'ADJUSTMENT'));
  }),

  /* --------------------------------------------------------- invoices */
  mswHttp.get(`${SELLER_BASE}/finance/invoices`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: '-issuedAt' });
    let rows = sellerInvoices(c.user.sellerId);
    if (url.searchParams.get('from')) rows = rows.filter((row) => row.issuedAt >= url.searchParams.get('from'));
    if (url.searchParams.get('to')) rows = rows.filter((row) => row.issuedAt <= `${url.searchParams.get('to')}T23:59:59.999Z`);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['invoiceNo', 'orderId', 'customerName'],
      filterSpec: { type: 'type' },
      sortable: ['issuedAt', 'totalPaise'],
      facetFields: ['type'],
    });
    return okList(items, meta);
  }),

  /* --------------------------------------------------------------- tax */
  mswHttp.get(`${SELLER_BASE}/finance/tax`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerTaxSummaries(c.user.sellerId));
  }),
];
