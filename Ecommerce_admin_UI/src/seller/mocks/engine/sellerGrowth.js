import { filter, find, findById, id, insert, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { canTransitionCampaign, summariseCampaignStats } from '@mocks/engine/ads';

/**
 * Seller-side advertising and promotions over the shared `adCampaigns`,
 * `flashSaleNominations`, `deals` and `coupons` collections the admin Marketing
 * and Ad Review screens read. A campaign a seller submits lands in the admin ad
 * review queue; a flash-sale nomination lands in admin curation.
 */

/* --------------------------------------------------------------- advertising */

export function campaignRow(c) {
  const stats = summariseCampaignStats(filter('adDailyStats', (s) => s.campaignId === c.id));
  const acosPct = stats.adGmvPaise ? Number(((stats.spendPaise / stats.adGmvPaise) * 100).toFixed(1)) : 0;
  const group = find('adGroups', (g) => g.campaignId === c.id);
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    dailyBudgetPaise: c.dailyBudgetPaise,
    totalBudgetPaise: c.totalBudgetPaise,
    biddingType: c.biddingType,
    startDate: c.startDate,
    endDate: c.endDate,
    pauseReason: c.pauseReason,
    rejectReason: c.rejectReason,
    productCount: group?.productIds?.length ?? 0,
    keywordCount: group?.keywords?.length ?? 0,
    ...stats,
    acosPct,
  };
}

export function sellerCampaigns(sellerId) {
  return filter('adCampaigns', (c) => c.sellerId === sellerId).map(campaignRow);
}

export function campaignDetail(c) {
  const group = find('adGroups', (g) => g.campaignId === c.id);
  const daily = filter('adDailyStats', (s) => s.campaignId === c.id).sort((a, b) => a.date.localeCompare(b.date));
  const products = (group?.productIds ?? []).map((pid) => {
    const p = findById('products', pid);
    return { id: pid, title: p?.title ?? pid, image: p?.images?.[0] ?? null, status: p?.status };
  });
  return { ...campaignRow(c), group: group ? { id: group.id, targetingType: group.targetingType, defaultBidPaise: group.defaultBidPaise, keywords: group.keywords ?? [] } : null, products, daily };
}

export function createCampaign(seller, body) {
  const productIds = Array.isArray(body?.productIds) ? body.productIds.filter(Boolean) : [];
  if (!body?.name) return { error: 'Name your campaign.' };
  if (!productIds.length) return { error: 'Add at least one product to promote.' };
  const daily = Number(body?.dailyBudgetPaise);
  if (!daily || daily <= 0) return { error: 'Set a daily budget.' };
  const automatic = body?.biddingType !== 'MANUAL_CPC';

  const campaign = insert('adCampaigns', {
    id: id('ADC', 5),
    name: body.name,
    type: 'SPONSORED_PRODUCT',
    sellerId: seller.id,
    sellerName: seller.storeName,
    status: 'DRAFT',
    dailyBudgetPaise: daily,
    totalBudgetPaise: Number(body?.totalBudgetPaise) || daily * 30,
    biddingType: automatic ? 'AUTOMATIC' : 'MANUAL_CPC',
    startDate: mockNowIso(),
    endDate: null,
    pauseReason: null,
    rejectReason: null,
    submittedAt: null,
    decidedByName: null,
    createdAt: mockNowIso(),
    createdBySeller: true,
    version: 1,
  });
  insert('adGroups', {
    id: id('ADG', 5),
    campaignId: campaign.id,
    name: 'Ad group 1',
    targetingType: automatic ? 'AUTOMATIC' : 'MANUAL',
    defaultBidPaise: Number(body?.defaultBidPaise) || 200,
    productIds,
    keywords: automatic ? [] : (body?.keywords ?? []).map((k) => ({ term: k.term ?? k, matchType: k.matchType ?? 'BROAD', bidPaise: Number(k.bidPaise) || 200 })),
    version: 1,
  });
  return { campaign: campaignDetail(campaign) };
}

const ACTION_TO_STATE = { submit: 'PENDING_REVIEW', pause: 'PAUSED', resume: 'ACTIVE', end: 'ENDED', archive: 'ARCHIVED' };

export function transitionCampaign(c, action) {
  const to = ACTION_TO_STATE[action];
  if (!to) return { error: 'Unknown action.' };
  if (!canTransitionCampaign(c.status, to)) return { error: `A ${c.status.toLowerCase()} campaign cannot be ${action}ed.` };
  const patch = { status: to };
  if (action === 'submit') patch.submittedAt = mockNowIso();
  if (action === 'pause') patch.pauseReason = 'ADVERTISER';
  if (action === 'resume') patch.pauseReason = null;
  if (action === 'end') patch.endDate = mockNowIso();
  update('adCampaigns', c.id, patch);
  return { campaign: campaignDetail(findById('adCampaigns', c.id)) };
}

export function updateCampaignBudget(c, body) {
  const patch = {};
  if (Number(body?.dailyBudgetPaise) > 0) patch.dailyBudgetPaise = Number(body.dailyBudgetPaise);
  if (Number(body?.totalBudgetPaise) > 0) patch.totalBudgetPaise = Number(body.totalBudgetPaise);
  update('adCampaigns', c.id, patch);
  return { campaign: campaignDetail(findById('adCampaigns', c.id)) };
}

export function walletFor(sellerId) {
  const wallet = find('advertiserWallets', (w) => w.sellerId === sellerId);
  if (!wallet) return null;
  const ledger = filter('advertiserLedger', (l) => l.walletId === wallet.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    ...wallet,
    lowBalance: wallet.fundingMode === 'PREPAID' && (wallet.balancePaise ?? 0) < (wallet.lowBalanceThresholdPaise ?? 0),
    ledger: ledger.slice(0, 20),
  };
}

export function rechargeWallet(wallet, amountPaise) {
  if (wallet.fundingMode !== 'PREPAID') return { error: 'This account is billed from payouts, not prepaid.' };
  if (!amountPaise || amountPaise <= 0) return { error: 'Enter an amount.' };
  update('advertiserWallets', wallet.id, { balancePaise: (wallet.balancePaise ?? 0) + amountPaise });
  insert('advertiserLedger', { id: id('ADL', 6), walletId: wallet.id, sellerId: wallet.sellerId, type: 'RECHARGE', amountPaise, description: 'Wallet recharge', createdAt: mockNowIso() });
  return { wallet: walletFor(wallet.sellerId) };
}

/* ---------------------------------------------------------------- promotions */

export function flashSaleRow(sale, sellerId) {
  const mine = filter('flashSaleNominations', (n) => n.flashSaleId === sale.id && n.sellerId === sellerId);
  return {
    id: sale.id,
    name: sale.name,
    status: sale.status,
    startsAt: sale.startsAt,
    endsAt: sale.endsAt,
    categoryRootNames: sale.categoryRootNames,
    minDiscountPct: sale.minDiscountPct,
    nominationsOpen: sale.status === 'NOMINATIONS_OPEN',
    myNominations: mine.length,
  };
}

export function sellerNominations(sellerId) {
  return filter('flashSaleNominations', (n) => n.sellerId === sellerId).map((n) => {
    const sale = findById('flashSales', n.flashSaleId);
    return { ...n, flashSaleName: sale?.name ?? '—', flashSaleStatus: sale?.status ?? null };
  });
}

export function nominate(sale, seller, body) {
  if (sale.status !== 'NOMINATIONS_OPEN') return { error: 'Nominations are closed for this flash sale.' };
  const offer = findById('offers', body?.offerId);
  if (!offer || offer.sellerId !== seller.id) return { error: 'Pick one of your own listings.' };
  const flashPrice = Number(body?.flashPricePaise);
  if (!flashPrice || flashPrice <= 0) return { error: 'Enter your flash-sale price.' };
  const discountPct = Math.round((1 - flashPrice / offer.sellingPricePaise) * 100);
  const product = findById('products', offer.productId);

  const autoReject = discountPct < (sale.minDiscountPct ?? 50);
  const nomination = insert('flashSaleNominations', {
    id: id('FSNOM', 6),
    flashSaleId: sale.id,
    productId: offer.productId,
    productTitle: product?.title ?? 'Product',
    sellerId: seller.id,
    sellerName: seller.storeName,
    currentPricePaise: offer.sellingPricePaise,
    flashPricePaise: flashPrice,
    discountPct,
    committedStock: Number(body?.committedStock) || 20,
    unitsSold: 0,
    order: 99,
    hero: false,
    status: autoReject ? 'AUTO_REJECTED' : 'PENDING',
    rejectReason: autoReject ? `Below the minimum ${sale.minDiscountPct}% discount` : null,
    version: 1,
  });
  return { nomination, autoRejected: autoReject };
}

export function sellerDeals(sellerId) {
  return filter('deals', (d) => d.sellerId === sellerId);
}

export function sellerCoupons(sellerId) {
  return filter('coupons', (c) => c.sellerId === sellerId);
}

export function createCoupon(seller, body) {
  const code = String(body?.code ?? '').trim().toUpperCase();
  if (!code) return { error: 'Enter a coupon code.' };
  if (find('coupons', (c) => c.code === code)) return { error: 'That code is already in use.' };
  const type = ['PERCENT', 'FLAT'].includes(body?.type) ? body.type : 'PERCENT';
  const value = Number(body?.value);
  if (!value || value <= 0) return { error: 'Enter the discount value.' };

  const coupon = insert('coupons', {
    id: id('CPN', 5),
    code,
    name: body?.name || code,
    description: body?.name || `${code} offer`,
    terms: 'Seller-funded offer. Terms apply.',
    type,
    valuePct: type === 'PERCENT' ? value : null,
    valuePaise: type === 'FLAT' ? Math.round(value * 100) : null,
    maxDiscountPaise: body?.maxDiscountPaise ? Math.round(body.maxDiscountPaise * 100) : null,
    minCartPaise: body?.minCart ? Math.round(body.minCart * 100) : 0,
    appliesTo: 'CART_TOTAL',
    scope: { sellerId: seller.id },
    audience: 'ALL',
    fundedBy: 'SELLER',
    sellerId: seller.id,
    stackable: false,
    visibility: 'PUBLIC',
    totalLimit: Number(body?.totalLimit) || 1000,
    totalRedemptions: 0,
    perUserLimit: 1,
    budgetPaise: Number(body?.budget) ? Math.round(body.budget * 100) : 100000 * 100,
    budgetUsedPaise: 0,
    status: 'ACTIVE',
    startsAt: mockNowIso(),
    endsAt: new Date(mockNow() + 30 * 86400_000).toISOString(),
    createdByName: seller.storeName,
    createdAt: mockNowIso(),
    version: 1,
  });
  return { coupon };
}
