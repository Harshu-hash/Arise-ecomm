import { http as mswHttp } from 'msw';
import { db, filter, findById, update } from '@mocks/db/store';
import { writeAudit } from '@mocks/engine/audit';
import { evaluateCoupon } from '@mocks/engine/coupons';
import { mockNowIso } from '@mocks/engine/settings';
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
  updateCampaignTargeting,
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

  mswHttp.patch(`${SELLER_BASE}/ads/campaigns/:id/targeting`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaign = ownCampaign(c.user, params.id);
    if (!campaign) return notFound('That campaign is not on your account.');
    const { error, campaign: updated } = updateCampaignTargeting(campaign, await request.json());
    if (error) return badRequest(error, 'TARGETING_INVALID');
    writeAudit({ actor: c.user, action: 'ad_campaign.targeting_update', entityType: 'adCampaign', entityId: campaign.id, entityLabel: campaign.name });
    scheduleSave();
    return ok(updated);
  }),

  mswHttp.get(`${SELLER_BASE}/ads/campaigns/:id/report`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaign = ownCampaign(c.user, params.id);
    if (!campaign) return notFound('That campaign is not on your account.');
    const detail = campaignDetail(campaign);
    const totals = detail.daily.reduce((acc, row) => ({ impressions: acc.impressions + (row.impressions ?? 0), clicks: acc.clicks + (row.clicks ?? 0), spendPaise: acc.spendPaise + (row.spendPaise ?? 0), attributedRevenuePaise: acc.attributedRevenuePaise + (row.adGmvPaise ?? 0) }), { impressions: 0, clicks: 0, spendPaise: 0, attributedRevenuePaise: 0 });
    const productRows = detail.products.map((product, index) => ({ ...product, impressions: Math.round(totals.impressions / Math.max(1, detail.products.length)), clicks: Math.round(totals.clicks / Math.max(1, detail.products.length)), spendPaise: Math.round(totals.spendPaise / Math.max(1, detail.products.length)), attributedRevenuePaise: Math.round(totals.attributedRevenuePaise / Math.max(1, detail.products.length)), orders: Math.max(0, Math.round((totals.clicks / Math.max(1, detail.products.length)) * 0.05) + (index % 2)) }));
    const searchTerms = (detail.group?.keywords ?? []).map((keyword, index) => ({ term: keyword.term, matchType: keyword.matchType, clicks: Math.max(1, Math.round(totals.clicks / Math.max(1, detail.group.keywords.length)) - index), spendPaise: Math.round(totals.spendPaise / Math.max(1, detail.group.keywords.length)), attributedRevenuePaise: Math.round(totals.attributedRevenuePaise / Math.max(1, detail.group.keywords.length)) }));
    return ok({ campaignId: campaign.id, totals, productRows, searchTerms, attributionDefinition: 'An order is attributed when the shopper clicked this campaign before ordering within the platform attribution window.' });
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

  mswHttp.get(`${SELLER_BASE}/ads/billing`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const campaignIds = new Set(db.adCampaigns.filter((row) => row.sellerId === c.user.sellerId).map((row) => row.id));
    const spendLedger = db.adDailyStats.filter((row) => campaignIds.has(row.campaignId)).map((row) => ({ id: `BILL-${row.campaignId}-${row.date}`, campaignId: row.campaignId, date: row.date, type: 'AD_SPEND', amountPaise: row.spendPaise ?? 0 }));
    const billedSpendPaise = spendLedger.reduce((sum, row) => sum + row.amountPaise, 0);
    const wallet = db.advertiserWallets.find((row) => row.sellerId === c.user.sellerId);
    return ok({ billedSpendPaise, ledgerSpendPaise: billedSpendPaise, variancePaise: 0, reconciled: true, attributionDefinition: 'Attributed revenue uses orders placed after an ad click within the platform attribution window; billing uses valid clicks.', spendLedger, walletLedger: wallet ? filter('advertiserLedger', (row) => row.walletId === wallet.id) : [], invoices: filter('adInvoices', (row) => row.sellerId === c.user.sellerId) });
  }),

  mswHttp.get(`${SELLER_BASE}/ads/invoices/:id/download`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const invoice = findById('adInvoices', params.id);
    if (!invoice || invoice.sellerId !== c.user.sellerId) return notFound('Invoice not found.');
    return ok({ filename: `${invoice.invoiceNo.replaceAll('/', '-')}.pdf`, mimeType: 'application/pdf', url: `data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==`, expiresAt: new Date(Date.now() + 300000).toISOString() });
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

  mswHttp.patch(`${SELLER_BASE}/promotions/coupons/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const coupon = findById('coupons', params.id);
    if (!coupon || coupon.sellerId !== c.user.sellerId) return notFound('Coupon not found.');
    const body = await request.json();
    update('coupons', coupon.id, { name: body.name ?? coupon.name, endsAt: body.endsAt ?? coupon.endsAt, totalLimit: Number(body.totalLimit) || coupon.totalLimit, budgetPaise: Number(body.budgetPaise) || coupon.budgetPaise, version: (coupon.version ?? 0) + 1 });
    writeAudit({ actor: c.user, action: 'coupon.edit', entityType: 'coupon', entityId: coupon.id, entityLabel: coupon.code }); scheduleSave();
    return ok(findById('coupons', coupon.id));
  }),

  mswHttp.post(`${SELLER_BASE}/promotions/coupons/:id/:action`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const coupon = findById('coupons', params.id);
    if (!coupon || coupon.sellerId !== c.user.sellerId) return notFound('Coupon not found.');
    if (params.action === 'preview') {
      const body = await request.json();
      const amountPaise = Math.round(Number(body?.amountRupees ?? 2000) * 100);
      return ok({ coupon, amountPaise, result: evaluateCoupon(coupon, { customerId: null, items: [{ sellerId: c.user.sellerId, productId: 'PREVIEW', categoryId: null, brandId: null, pricePaise: amountPaise, qty: 1 }], paymentMethod: body?.paymentMethod ?? 'UPI', platform: 'WEB', fulfillmentType: 'SELLER' }) });
    }
    if (!['pause', 'resume', 'end'].includes(params.action)) return notFound('Coupon action not found.');
    const status = params.action === 'pause' ? 'PAUSED' : params.action === 'resume' ? 'ACTIVE' : 'EXPIRED';
    update('coupons', coupon.id, { status, ...(params.action === 'end' ? { endsAt: mockNowIso() } : {}), version: (coupon.version ?? 0) + 1 });
    writeAudit({ actor: c.user, action: `coupon.${params.action}`, entityType: 'coupon', entityId: coupon.id, entityLabel: coupon.code }); scheduleSave();
    return ok(findById('coupons', coupon.id));
  }),
];

export { campaignRow };
