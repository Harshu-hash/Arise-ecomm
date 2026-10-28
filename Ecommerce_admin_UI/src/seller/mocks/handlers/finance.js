import { http as mswHttp } from 'msw';
import { filter, findById } from '@mocks/db/store';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import {
  financeSummary,
  payoutRow,
  sellerInvoices,
  sellerPayouts,
  sellerSettlements,
  sellerTaxSummaries,
  settlementRow,
} from '@seller/mocks/engine/sellerFinance';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user };
}

export const sellerFinanceHandlers = [
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
    const query = parseListQuery(new URL(request.url), { defaultSort: '-periodEnd' });
    const rows = sellerPayouts(c.user.sellerId);
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
    return ok({ ...payoutRow(payout), lines });
  }),

  /* -------------------------------------------------------- transactions */
  mswHttp.get(`${SELLER_BASE}/finance/transactions`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const url = new URL(request.url);
    const query = parseListQuery(url, { defaultSort: '-deliveredAt' });
    let rows = sellerSettlements(c.user.sellerId);
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

  /* --------------------------------------------------------- invoices */
  mswHttp.get(`${SELLER_BASE}/finance/invoices`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-issuedAt' });
    const rows = sellerInvoices(c.user.sellerId);
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
