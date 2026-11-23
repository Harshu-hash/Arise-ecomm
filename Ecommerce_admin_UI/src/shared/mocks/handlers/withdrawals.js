import { http as mswHttp } from 'msw';
import { guard } from '../engine/guard';
import { listResult, parseListQuery } from '../engine/list';
import { conflict, ok, okList, validationFailed } from '../engine/respond';
import { mockNowIso } from '../engine/settings';
import { adminView, moveWithdrawal, walletFor, withdrawals } from '../engine/walletMock';

const ADMIN = '/api/admin/v1';

const stuck = () => conflict('This withdrawal is no longer in a state that allows that.', 'WITHDRAWAL_NOT_ACTIONABLE');

/** The admin's withdrawal queue, for mock mode (the seller's side is in seller/mocks/handlers/wallet.js). */
export const withdrawalHandlers = [
  mswHttp.get(`${ADMIN}/withdrawals`, async ({ request }) => {
    const url = new URL(request.url);
    const g = await guard(request, url, 'finance.payout.view');
    if (g.response) return g.response;
    const query = parseListQuery(url, { defaultSort: '-requestedAt' });
    const result = listResult(withdrawals.map(adminView), query, { searchFields: ['number', 'sellerName'], filterSpec: { status: 'status' }, sortable: ['requestedAt', 'amountPaise'], facetFields: ['status'] });
    return okList(result.items, result.meta);
  }),
  mswHttp.post(`${ADMIN}/withdrawals/:id/approve`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.approve');
    if (g.response) return g.response;
    const row = moveWithdrawal(params.id, ['REQUESTED'], 'APPROVED', { approvedAt: mockNowIso() }, mockNowIso());
    return row ? ok(adminView(row)) : stuck();
  }),
  mswHttp.post(`${ADMIN}/withdrawals/:id/reject`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.approve');
    if (g.response) return g.response;
    const body = await request.json().catch(() => ({}));
    if (!String(body.reason ?? '').trim()) return validationFailed({ reason: 'Tell the seller why.' });
    const row = moveWithdrawal(params.id, ['REQUESTED', 'APPROVED'], 'REJECTED', { decisionReason: body.reason }, mockNowIso(), body.reason);
    return row ? ok(adminView(row)) : stuck();
  }),
  mswHttp.post(`${ADMIN}/withdrawals/:id/pay`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    if (g.response) return g.response;
    const body = await request.json().catch(() => ({}));
    if (String(body.txnNo ?? '').trim().length < 4) return validationFailed({ txnNo: 'Enter the bank / UPI transaction number.' });
    const row = moveWithdrawal(params.id, ['APPROVED'], 'PAID', { paidAt: mockNowIso(), txnNo: body.txnNo, utr: body.utr ?? '' }, mockNowIso(), body.txnNo);
    return row ? ok(adminView(row)) : stuck();
  }),
  mswHttp.get(`${ADMIN}/seller-wallets/:sellerId`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    return g.response ?? ok(walletFor(params.sellerId));
  }),
  mswHttp.get(`${ADMIN}/seller-wallets/:sellerId/transactions`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.view');
    return g.response ?? okList([], { page: 1, pageSize: 10, total: 0, totalPages: 1 });
  }),
  mswHttp.post(`${ADMIN}/seller-wallets/:sellerId/adjustments`, async ({ request, params }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.adjust');
    return g.response ?? ok(walletFor(params.sellerId)); // the mock has no ledger to adjust
  }),
  mswHttp.post(`${ADMIN}/settlements/cod-remitted`, async ({ request }) => {
    const g = await guard(request, new URL(request.url), 'finance.payout.release');
    return g.response ?? ok({ marked: 0 }); // mock settlement lines are not cash-on-delivery
  }),
];
