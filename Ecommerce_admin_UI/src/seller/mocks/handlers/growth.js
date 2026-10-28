import { http as mswHttp } from 'msw';
import { db, findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { parseListQuery, listResult } from '@mocks/engine/list';
import { badRequest, conflict, created, notFound, ok, okList, unauthorized } from '@mocks/engine/respond';
import { resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  campaignDetail,
  campaignRow,
  createCampaign,
  createCoupon,
  flashSaleRow,
  nominate,
  rechargeWallet,
  sellerCampaigns,
  sellerCoupons,
  sellerDeals,
  sellerNominations,
  transitionCampaign,
  updateCampaignBudget,
  walletFor,
} from '@seller/mocks/engine/sellerGrowth';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

const ownCampaign = (user, id) => {
  const c = findById('adCampaigns', id);
  return c && c.sellerId === user.sellerId ? c : null;
};

function campaignAction(action) {
  return async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaign = ownCampaign(c.user, params.id);
    if (!campaign) return notFound('That campaign is not on your account.');
    const { error, campaign: updated } = transitionCampaign(campaign, action);
    if (error) return conflict(error, 'ILLEGAL_TRANSITION');
    scheduleSave();
    return ok(updated);
  };
}

export const sellerGrowthHandlers = [
  /* ---------------------------------------------------------- campaigns */
  mswHttp.get(`${SELLER_BASE}/ads/campaigns`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-createdAt' });
    const rows = sellerCampaigns(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['name', 'id'],
      filterSpec: { status: 'status' },
      sortable: ['spendPaise', 'impressions', 'clicks', 'acosPct'],
      facetFields: ['status'],
    });
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/ads/campaigns/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaign = ownCampaign(c.user, params.id);
    if (!campaign) return notFound('That campaign is not on your account.');
    return ok(campaignDetail(campaign));
  }),

  mswHttp.post(`${SELLER_BASE}/ads/campaigns`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, campaign } = createCampaign(c.seller, body);
    if (error) return badRequest(error, 'CAMPAIGN_INVALID');
    scheduleSave();
    return created(campaign);
  }),

  mswHttp.patch(`${SELLER_BASE}/ads/campaigns/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaign = ownCampaign(c.user, params.id);
    if (!campaign) return notFound('That campaign is not on your account.');
    const body = await request.json();
    const { campaign: updated } = updateCampaignBudget(campaign, body);
    scheduleSave();
    return ok(updated);
  }),

  mswHttp.post(`${SELLER_BASE}/ads/campaigns/:id/submit`, campaignAction('submit')),
  mswHttp.post(`${SELLER_BASE}/ads/campaigns/:id/pause`, campaignAction('pause')),
  mswHttp.post(`${SELLER_BASE}/ads/campaigns/:id/resume`, campaignAction('resume')),
  mswHttp.post(`${SELLER_BASE}/ads/campaigns/:id/end`, campaignAction('end')),

  /* --------------------------------------------------------------- wallet */
  mswHttp.get(`${SELLER_BASE}/ads/wallet`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(walletFor(c.user.sellerId));
  }),

  mswHttp.post(`${SELLER_BASE}/ads/wallet/recharge`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const wallet = db.advertiserWallets.find((w) => w.sellerId === c.user.sellerId);
    if (!wallet) return notFound('No advertiser wallet on this account.');
    const body = await request.json();
    const { error, wallet: updated } = rechargeWallet(wallet, Math.round(Number(body?.amount) * 100));
    if (error) return badRequest(error, 'RECHARGE_INVALID');
    scheduleSave();
    return ok(updated);
  }),

  /* ------------------------------------------------------------ promotions */
  mswHttp.get(`${SELLER_BASE}/promotions/flash-sales`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(db.flashSales.map((s) => flashSaleRow(s, c.user.sellerId)));
  }),

  mswHttp.post(`${SELLER_BASE}/promotions/flash-sales/:id/nominate`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const sale = findById('flashSales', params.id);
    if (!sale) return notFound('That flash sale does not exist.');
    const body = await request.json();
    const { error, nomination, autoRejected } = nominate(sale, c.seller, body);
    if (error) return badRequest(error, 'NOMINATION_INVALID');
    scheduleSave();
    return created({ ...nomination, autoRejected });
  }),

  mswHttp.get(`${SELLER_BASE}/promotions/nominations`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerNominations(c.user.sellerId));
  }),

  mswHttp.get(`${SELLER_BASE}/promotions/deals`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(sellerDeals(c.user.sellerId));
  }),

  mswHttp.get(`${SELLER_BASE}/promotions/coupons`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-createdAt' });
    const rows = sellerCoupons(c.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['code', 'name'],
      filterSpec: { status: 'status' },
      sortable: ['createdAt', 'totalRedemptions'],
    });
    return okList(items, meta);
  }),

  mswHttp.post(`${SELLER_BASE}/promotions/coupons`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, coupon } = createCoupon(c.seller, body);
    if (error) return badRequest(error, 'COUPON_INVALID');
    scheduleSave();
    return created(coupon);
  }),
];

export { campaignRow };
