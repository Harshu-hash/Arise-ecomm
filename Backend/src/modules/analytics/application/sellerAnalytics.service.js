import { NotFoundError } from '../../../shared/errors/AppError.js';
import { Order, Return } from '../../order/public/index.js';
import { Offer } from '../../product/public/index.js';
import { SettlementLine } from '../../settlement/public/index.js';
import { shipmentsSummary } from './sellerOperations.js';
import { dayKey, deltaPct, endOfDay, fulfilmentFunnel, pct, rangeDays, startOfDay, sum, TZ } from '../domain/services/analyticsRules.js';

// The seller's analytics tabs, always scoped to the signed-in seller and a from/to window (inclusive IST days). Sales, earnings,
// returns and fulfilment are real. Storefront traffic (impressions, views, add-to-cart) and ad performance are not tracked yet, so those
// answer zeros and empty lists, and the "conversion funnel" is the order funnel (placed -> delivered).

const LIVE = { $nin: ['CANCELLED', 'RTO_DELIVERED'] };
const first = async (promise) => (await promise)[0] ?? {};
const labelled = (rows) => rows.map(({ _id, ...row }) => ({ label: _id ?? 'Unknown', ...row }));
const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

const DEFINITIONS = {
  attributedRevenue: 'GMV from orders attributed to an ad click. Ad attribution is not tracked yet.',
  lostSales: 'Estimated sales missed while a listing had no stock. Needs storefront view tracking, which is not available yet.',
  netEarnings: 'Sale amount less commission, fees and tax on delivered orders, from your settlement lines.',
  conversion: 'Orders divided by product views. Product views are not tracked yet.',
};

function periodOf({ from, to }) {
  const days = rangeDays(from, to);
  if (!days.length) throw new NotFoundError('Choose a valid date range.');
  return { from: days[0], to: days.at(-1), days, since: startOfDay(days[0]), until: endOfDay(days.at(-1)) };
}

/** Which offers a sku / fulfilment filter allows (null = no such filter). */
async function allowedOffers(sellerId, { sku, fulfillmentType }) {
  if (!sku && !fulfillmentType) return null;
  const offers = await Offer.find({ sellerId, ...(sku ? { sku } : {}), ...(fulfillmentType ? { fulfillmentType } : {}) }, '_id').lean();
  return offers.map((offer) => offer._id);
}

/** Live items of this seller's parcels placed in the window, after the category/brand/sku/fulfilment filters. */
function itemStages(sellerId, period, filters, offerIds) {
  return [
    { $match: { placedAt: { $gte: period.since, $lt: period.until }, 'subOrders.sellerId': sellerId } },
    { $unwind: '$subOrders' },
    { $match: { 'subOrders.sellerId': sellerId, 'subOrders.status': LIVE } },
    { $unwind: '$subOrders.items' },
    {
      $match: {
        ...(filters.categoryId ? { 'subOrders.items.category': filters.categoryId } : {}),
        ...(filters.brandId ? { 'subOrders.items.brand': filters.brandId } : {}),
        ...(offerIds ? { 'subOrders.items.offerId': { $in: offerIds } } : {}),
      },
    },
  ];
}

const totalsOf = (sellerId, period, filters, offerIds) => first(Order.aggregate([
  ...itemStages(sellerId, period, filters, offerIds),
  { $group: { _id: null, gmvPaise: { $sum: '$subOrders.items.amountPaise' }, units: { $sum: '$subOrders.items.quantity' }, discountPaise: { $sum: { $ifNull: ['$subOrders.items.discountPaise', 0] } }, orderIds: { $addToSet: '$_id' } } },
  { $project: { _id: 0, gmvPaise: 1, units: 1, discountPaise: 1, orders: { $size: '$orderIds' } } },
]));

const funnelOf = async (sellerId, period) => {
  const rows = await Order.aggregate([
    { $match: { placedAt: { $gte: period.since, $lt: period.until }, 'subOrders.sellerId': sellerId } },
    { $unwind: '$subOrders' },
    { $match: { 'subOrders.sellerId': sellerId } },
    { $group: { _id: '$subOrders.status', n: { $sum: 1 } } },
  ]);
  return fulfilmentFunnel(Object.fromEntries(rows.map((row) => [row._id, row.n]))).map(({ stage, count }) => ({ key: stage.toLowerCase(), label: stage, value: count }));
};

const earnings = (sellerId, period) => first(SettlementLine.aggregate([
  { $match: { sellerId, deliveredAt: { $gte: period.since, $lt: period.until }, reversedAt: null } },
  { $group: { _id: null, sale: { $sum: '$salePaise' }, fees: { $sum: { $add: ['$feesBeforeTaxPaise', '$gstOnFeesPaise'] } }, tax: { $sum: { $add: ['$tcsPaise', '$tdsPaise'] } }, net: { $sum: '$netPaise' } } },
]));

const VIEWS = {
  async overview({ sellerId, period, filters, offerIds, compare }) {
    const [totals, daily, categories, states, cancelled, returns, net, funnel, previous] = await Promise.all([
      totalsOf(sellerId, period, filters, offerIds),
      Order.aggregate([
        ...itemStages(sellerId, period, filters, offerIds),
        { $group: { _id: day('$placedAt'), gmvPaise: { $sum: '$subOrders.items.amountPaise' }, units: { $sum: '$subOrders.items.quantity' }, orderIds: { $addToSet: '$_id' } } },
        { $project: { gmvPaise: 1, units: 1, orders: { $size: '$orderIds' } } },
      ]),
      Order.aggregate([...itemStages(sellerId, period, filters, offerIds), { $group: { _id: '$subOrders.items.category', value: { $sum: '$subOrders.items.amountPaise' } } }, { $sort: { value: -1 } }, { $limit: 8 }]).then(labelled),
      Order.aggregate([...itemStages(sellerId, period, filters, offerIds), { $group: { _id: '$address.state', orderIds: { $addToSet: '$_id' } } }, { $project: { value: { $size: '$orderIds' } } }, { $sort: { value: -1 } }, { $limit: 8 }]).then(labelled),
      Order.aggregate([
        { $match: { placedAt: { $gte: period.since, $lt: period.until }, 'subOrders.sellerId': sellerId } },
        { $unwind: '$subOrders' },
        { $match: { 'subOrders.sellerId': sellerId, 'subOrders.status': 'CANCELLED' } },
        { $count: 'n' },
      ]),
      Return.countDocuments({ sellerId, createdAt: { $gte: period.since, $lt: period.until } }),
      earnings(sellerId, period),
      funnelOf(sellerId, period),
      compare ? totalsOf(sellerId, previousPeriod(period), filters, offerIds) : null,
    ]);
    const byDay = new Map(daily.map(({ _id, ...row }) => [_id, row]));
    const salesSeries = period.days.map((date) => ({ date, gmvPaise: 0, units: 0, orders: 0, ...byDay.get(date) }));
    return {
      funnel,
      series: [], // storefront traffic is not tracked yet
      salesSeries,
      salesBreakdowns: { category: categories },
      kpis: {
        gmvPaise: totals.gmvPaise ?? 0,
        orders: totals.orders ?? 0,
        salesOrders: sum(salesSeries, 'orders'),
        units: totals.units ?? 0,
        unitsSold: totals.units ?? 0,
        aspPaise: totals.units ? Math.round(totals.gmvPaise / totals.units) : 0,
        discountPaise: totals.discountPaise ?? 0,
        cancellations: cancelled[0]?.n ?? 0,
        returns,
        netEarningsPaise: net.net ?? 0,
      },
      breakdowns: { channel: [], category: [], geography: states },
      comparison: previous ? { gmvPct: deltaPct(totals.gmvPaise ?? 0, previous.gmvPaise ?? 0), ordersPct: deltaPct(totals.orders ?? 0, previous.orders ?? 0), conversionPct: null } : null,
    };
  },

  async products({ sellerId, period, filters, offerIds }) {
    const [offers, sold] = await Promise.all([
      Offer.find({ sellerId, status: { $in: ['LIVE', 'INACTIVE'] } }).sort({ updatedAt: -1 }).limit(200).lean(),
      Order.aggregate([
        ...itemStages(sellerId, period, filters, offerIds),
        { $group: { _id: '$subOrders.items.offerId', gmvPaise: { $sum: '$subOrders.items.amountPaise' }, orderIds: { $addToSet: '$_id' }, itemIds: { $push: '$subOrders.items._id' } } },
      ]),
    ]);
    const itemIds = sold.flatMap((row) => row.itemIds);
    const lines = itemIds.length ? await SettlementLine.find({ sellerId, orderItemId: { $in: itemIds }, reversedAt: null }, 'orderItemId netPaise').lean() : [];
    const netByItem = new Map(lines.map((line) => [String(line.orderItemId), line.netPaise]));
    const byOffer = new Map(sold.map((row) => [String(row._id), row]));
    return {
      rows: offers.map((offer) => {
        const row = byOffer.get(String(offer._id));
        return {
          id: String(offer._id),
          listingId: String(offer._id),
          productId: String(offer.productId),
          productTitle: offer.productTitle,
          sku: offer.sku ?? offer.sellerSku,
          impressions: 0,
          productViews: 0,
          orders: row?.orderIds.length ?? 0,
          conversionPct: 0,
          gmvPaise: row?.gmvPaise ?? 0,
          netEarningsPaise: (row?.itemIds ?? []).reduce((total, id) => total + (netByItem.get(String(id)) ?? 0), 0),
          buyBoxSharePct: offer.buyBoxWinner ? 100 : 0,
          lostSalesPaise: 0,
          remediationPath: `/listings/${offer._id}`,
        };
      }),
    };
  },

  async traffic({ sellerId, period }) {
    return {
      funnel: await funnelOf(sellerId, period),
      series: [],
      sources: [],
      ads: { impressions: 0, clicks: 0, spendPaise: 0, attributedRevenuePaise: 0, orders: 0, ctrPct: 0, cpcPaise: 0, conversionPct: 0, roas: 0 },
    };
  },

  async operations({ sellerId, period }) {
    const [ops, reasons, offers] = await Promise.all([
      shipmentsSummary(sellerId, period),
      Return.aggregate([{ $match: { sellerId, createdAt: { $gte: period.since, $lt: period.until } } }, { $group: { _id: '$reasonCode', value: { $sum: 1 } } }, { $sort: { value: -1 } }]).then(labelled),
      Offer.find({ sellerId, status: 'LIVE', stock: { $gt: 0 } }, 'sku sellerSku productTitle stock reserved updatedAt').sort({ updatedAt: 1 }).limit(50).lean(),
    ]);
    return {
      kpis: { ...ops, returns: reasons.reduce((total, row) => total + row.value, 0) },
      returnReasons: reasons,
      // shortcut: age = days since the listing's stock last changed; per-unit receipt dates are not kept
      inventoryAgeing: offers.map((offer) => ({ sku: offer.sku ?? offer.sellerSku, productTitle: offer.productTitle, available: offer.stock - offer.reserved, ageDays: Math.floor((Date.now() - offer.updatedAt) / 86_400_000), warehouseId: null })),
    };
  },

  async finance({ sellerId, period }) {
    const [totals, rows] = await Promise.all([
      earnings(sellerId, period),
      SettlementLine.find({ sellerId, deliveredAt: { $gte: period.since, $lt: period.until } }, 'orderItemId salePaise commissionPaise feesBeforeTaxPaise netPaise').sort({ deliveredAt: -1 }).limit(100).lean(),
    ]);
    return {
      kpis: { grossPaise: totals.sale ?? 0, feesPaise: totals.fees ?? 0, taxPaise: totals.tax ?? 0, adjustmentsPaise: 0, netEarningsPaise: totals.net ?? 0 },
      rows: rows.map((row) => ({ id: String(row._id), orderItemId: String(row.orderItemId), salePaise: row.salePaise, commissionPaise: row.commissionPaise, feesBeforeTaxPaise: row.feesBeforeTaxPaise, netPaise: row.netPaise })),
    };
  },
};

function previousPeriod(period) {
  const length = period.days.length * 86_400_000;
  return { ...period, since: new Date(period.since - length), until: period.since };
}

export async function getAnalyticsView(sellerId, view, query) {
  const today = dayKey(new Date());
  const to = query.to ?? today;
  const period = periodOf({ from: query.from ?? dayKey(new Date(startOfDay(to).getTime() - 29 * 86_400_000)), to });
  const filters = { categoryId: query.categoryId, brandId: query.brandId };
  const offerIds = await allowedOffers(sellerId, query);
  const body = await VIEWS[view]({ sellerId, period, filters, offerIds, compare: query.compare === 'true' || query.compare === true });
  return { view, period: { from: period.from, to: period.to, compare: Boolean(query.compare === 'true' || query.compare === true), timezone: TZ }, freshnessAt: new Date().toISOString(), definitions: DEFINITIONS, ...body };
}

/** The choices the analytics filter bar offers: this seller's own categories, brands, SKUs. */
export async function getAnalyticsFilters(sellerId) {
  const [paths, brands, skus] = await Promise.all([
    Offer.distinct('categoryPath', { sellerId }),
    Offer.distinct('brandName', { sellerId }),
    Offer.find({ sellerId }, 'sku sellerSku').lean(),
  ]);
  const options = (list) => [...new Set(list.filter(Boolean))].sort().map((value) => ({ value, label: value }));
  return {
    timezones: [TZ, 'UTC'],
    warehouses: [], // no warehouses yet: sellers ship from their own pickup address
    categories: options(paths.map((path) => path.split(' › ').pop())),
    brands: options(brands),
    skus: options(skus.map((offer) => offer.sku ?? offer.sellerSku)),
    fulfillmentTypes: ['SELLER', 'ARISE'],
  };
}
