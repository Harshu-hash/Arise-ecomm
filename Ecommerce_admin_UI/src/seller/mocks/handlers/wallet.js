import { http as mswHttp } from 'msw';
import { listResult, parseListQuery } from '@mocks/engine/list';
import { conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { mockNowIso } from '@mocks/engine/settings';
import { moveWithdrawal, requestWithdrawal, walletFor, withdrawals } from '@mocks/engine/walletMock';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

const SELLER = SELLER_BASE;
const seller = (request) => {
  const { user, error } = resolveCaller(request);
  return error ? { response: unauthorized() } : { user };
};

/** The seller's wallet and withdrawals, for mock mode (balances derive from the mock settlement lines). */
export const sellerWalletHandlers = [
  mswHttp.get(`${SELLER}/finance/wallet`, ({ request }) => {
    const c = seller(request);
    return c.response ?? ok(walletFor(c.user.sellerId));
  }),
  mswHttp.get(`${SELLER}/finance/wallet/transactions`, ({ request }) => seller(request).response ?? okList([], { page: 1, pageSize: 25, total: 0, totalPages: 1 })),
  mswHttp.get(`${SELLER}/finance/withdrawals`, ({ request }) => {
    const c = seller(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-requestedAt' });
    const result = listResult(withdrawals.filter((w) => w.sellerId === c.user.sellerId), query, { searchFields: ['number'], filterSpec: { status: 'status' }, sortable: ['requestedAt', 'amountPaise'] });
    return okList(result.items, result.meta);
  }),
  mswHttp.post(`${SELLER}/finance/withdrawals`, async ({ request }) => {
    const c = seller(request);
    if (c.response) return c.response;
    const body = await request.json().catch(() => ({}));
    const made = requestWithdrawal(c.user.sellerId, c.user.name ?? 'Seller', body.amountPaise, mockNowIso());
    return made.problem ? conflict(made.problem[1], made.problem[0]) : created(made.row);
  }),
  mswHttp.post(`${SELLER}/finance/withdrawals/:id/cancel`, ({ request, params }) => {
    const c = seller(request);
    if (c.response) return c.response;
    const own = withdrawals.find((w) => w.id === params.id && w.sellerId === c.user.sellerId);
    if (!own) return notFound('That withdrawal is not on your account.');
    return moveWithdrawal(params.id, ['REQUESTED'], 'CANCELLED', {}, mockNowIso()) ? ok(own) : conflict('This withdrawal is no longer in a state that allows that.', 'WITHDRAWAL_NOT_ACTIONABLE');
  }),
];
