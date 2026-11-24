import { Seller, User } from '../../identity/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { Payment } from '../../payment/public/index.js';
import { Offer, Product } from '../../product/public/index.js';
import { Shipment } from '../../shipping/public/index.js';
import { SettlementLine, Withdrawal } from '../../settlement/public/index.js';
import { pct, sum, windows } from '../domain/services/analyticsRules.js';

// Platform analytics, one builder per domain tab. Each reads the live collections for the last `days` days; a domain whose
// source is not built yet (support desk, referrals, ads) answers honest zeros and empty lists rather than invented numbers.

const SELLING = ['ACTIVE', 'APPROVED'];
const LIVE = { $nin: ['CANCELLED', 'RTO_DELIVERED'] };
const first = async (promise) => (await promise)[0] ?? {};
const labelled = (rows) => rows.map(({ _id, ...row }) => ({ label: _id ?? 'Unknown', ...row }));

/** Live items of orders placed since `since`, grouped by `key` (a Mongo expression), best first. */
const itemsBy = (since, key, limit = 5) => Order.aggregate([
  { $match: { placedAt: { $gte: since } } },
  { $unwind: '$subOrders' },
  { $match: { 'subOrders.status': LIVE } },
  { $unwind: '$subOrders.items' },
  { $group: { _id: key, gmvPaise: { $sum: '$subOrders.items.amountPaise' }, units: { $sum: '$subOrders.items.quantity' } } },
  { $sort: { gmvPaise: -1 } },
  { $limit: limit },
]).then(labelled);

const ordersBy = (since, key, limit = 5) => Order.aggregate([
  { $match: { placedAt: { $gte: since }, status: { $ne: 'CANCELLED' } } },
  { $group: { _id: key, orders: { $sum: 1 }, gmvPaise: { $sum: { $ifNull: ['$totals.subtotalPaise', 0] } } } },
  { $match: { _id: { $ne: null } } },
  { $sort: { gmvPaise: -1 } },
  { $limit: limit },
]).then(labelled);

const BUILDERS = {
  async sales({ since }) {
    const t = await first(Order.aggregate([
      { $match: { placedAt: { $gte: since } } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.status': LIVE } },
      { $group: { _id: null, gmvPaise: { $sum: { $ifNull: ['$subOrders.itemsPaise', 0] } }, units: { $sum: { $sum: '$subOrders.items.quantity' } }, orderIds: { $addToSet: '$_id' } } },
      { $project: { _id: 0, gmvPaise: 1, units: 1, orders: { $size: '$orderIds' } } },
    ]));
    const orders = t.orders ?? 0;
    const channel = await ordersBy(since, 'Customer app'); // the customer app is the only channel there is
    return {
      totals: { gmvPaise: t.gmvPaise ?? 0, orders, units: t.units ?? 0, aovPaise: orders ? Math.round(t.gmvPaise / orders) : 0 },
      byCategory: await itemsBy(since, '$subOrders.items.category'),
      byChannel: channel.map(({ label, orders: n, gmvPaise }) => ({ label, orders: n, gmvPaise })),
      byCity: await ordersBy(since, '$address.city'),
    };
  },

  async customers({ since }) {
    const [newCustomers, total, repeat, spend, cities] = await Promise.all([
      User.countDocuments({ role: 'CUSTOMER', createdAt: { $gte: since } }),
      User.countDocuments({ role: 'CUSTOMER' }),
      Order.aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: '$customerId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'n' }]),
      first(Order.aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, gmvPaise: { $sum: { $ifNull: ['$totals.subtotalPaise', 0] } } } }])),
      Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$address.city', customers: { $addToSet: '$customerId' }, gmvPaise: { $sum: { $ifNull: ['$totals.subtotalPaise', 0] } } } },
        { $match: { _id: { $ne: null } } },
        { $project: { count: { $size: '$customers' }, gmvPaise: 1 } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]).then(labelled),
    ]);
    return {
      totals: { newCustomers, returningCustomers: repeat[0]?.n ?? 0, totalCustomers: total, avgGmvPaise: total ? Math.round((spend.gmvPaise ?? 0) / total) : 0 },
      topCities: cities,
    };
  },

  async catalog() {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const [live, qc, slowQc, offers, byCategory] = await Promise.all([
      Product.countDocuments({ status: 'LIVE' }),
      Product.countDocuments({ status: 'QC_PENDING' }),
      Product.countDocuments({ status: 'QC_PENDING', updatedAt: { $lt: twoDaysAgo } }),
      first(Offer.aggregate([{ $match: { status: 'LIVE' } }, { $group: { _id: null, all: { $sum: 1 }, soldOut: { $sum: { $cond: [{ $lte: [{ $subtract: ['$stock', '$reserved'] }, 0] }, 1, 0] } } } }])),
      Product.aggregate([
        { $match: { status: 'LIVE' } },
        { $group: { _id: { $arrayElemAt: [{ $split: [{ $ifNull: ['$categoryPath', 'Uncategorised'] }, ' › '] }, -1] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).then(labelled),
    ]);
    return { totals: { liveListings: live, qcQueueSize: qc, qcHighPriority: slowQc, outOfStockPct: pct(offers.soldOut ?? 0, offers.all ?? 0) }, byCategory };
  },

  async sellers({ since }) {
    const [byStatus, byTier, cancellation] = await Promise.all([
      Seller.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).then(labelled),
      Seller.aggregate([{ $match: { status: { $in: SELLING } } }, { $group: { _id: '$tier', count: { $sum: 1 } } }]).then(labelled),
      Order.aggregate([
        { $match: { placedAt: { $gte: since } } },
        { $unwind: '$subOrders' },
        { $group: { _id: '$subOrders.sellerId', parcels: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$subOrders.status', 'CANCELLED'] }, 1, 0] } } } },
      ]),
    ]);
    const active = byStatus.filter((row) => SELLING.includes(row.label)).reduce((total, row) => total + row.count, 0);
    const rates = cancellation.map((row) => pct(row.cancelled, row.parcels));
    return {
      // seller ratings are not collected yet
      totals: { activeSellers: active, avgRating: null, avgCancellationPct: rates.length ? Number((sum(rates.map((v) => ({ v })), 'v') / rates.length).toFixed(2)) : 0 },
      onboardingFunnel: byStatus,
      byTier,
    };
  },

  async fulfilment({ since }) {
    const rows = await Shipment.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$courierName',
          count: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          ndrCount: { $sum: { $cond: [{ $in: ['DELIVERY_FAILED', '$events.status'] }, 1, 0] } },
          rto: { $sum: { $cond: [{ $in: ['$status', ['RTO', 'RTO_DELIVERED']] }, 1, 0] } },
        },
      },
    ]);
    const shipments = sum(rows, 'count');
    return {
      totals: { shipments, deliveredPct: pct(sum(rows, 'delivered'), shipments), ndrPct: pct(sum(rows, 'ndrCount'), shipments), rtoPct: pct(sum(rows, 'rto'), shipments) },
      byCourier: rows.filter((row) => row._id).map((row) => ({ label: row._id, count: row.count, ndrCount: row.ndrCount })).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  },

  async returns({ since }) {
    const [total, passed, failed, closed, units, byReason, bySeller] = await Promise.all([
      Return.countDocuments({ createdAt: { $gte: since } }),
      Return.countDocuments({ createdAt: { $gte: since }, status: { $in: ['QC_PASSED', 'REFUND_INITIATED', 'REFUND_COMPLETED'] } }),
      Return.countDocuments({ createdAt: { $gte: since }, status: 'QC_FAILED' }),
      Return.countDocuments({ createdAt: { $gte: since }, status: { $in: ['REFUND_COMPLETED', 'REJECTED', 'CANCELLED', 'QC_FAILED'] } }),
      first(Order.aggregate([{ $match: { placedAt: { $gte: since } } }, { $unwind: '$subOrders' }, { $match: { 'subOrders.status': LIVE } }, { $group: { _id: null, n: { $sum: { $sum: '$subOrders.items.quantity' } } } }])),
      Return.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$reasonCode', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]).then(labelled),
      Return.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$sellerName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]).then(labelled),
    ]);
    return { totals: { totalReturns: total, returnRatePct: pct(total, units.n ?? 0), qcFailPct: pct(failed, failed + passed), closedCount: closed }, byReason, bySeller };
  },

  async finance({ since }) {
    const [lines, refunds, paid, cod] = await Promise.all([
      first(SettlementLine.aggregate([{ $match: { deliveredAt: { $gte: since }, reversedAt: null } }, { $group: { _id: null, commission: { $sum: '$commissionPaise' }, fees: { $sum: '$feesBeforeTaxPaise' } } }])),
      // shortcut: refunds are counted on payments touched in the window; a refund-level timestamp would be exact
      first(Payment.aggregate([{ $match: { updatedAt: { $gte: since } } }, { $unwind: '$refunds' }, { $match: { 'refunds.status': 'SUCCEEDED' } }, { $group: { _id: null, paise: { $sum: '$refunds.amountPaise' } } }])),
      first(Withdrawal.aggregate([{ $match: { status: 'PAID', paidAt: { $gte: since } } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }])),
      first(SettlementLine.aggregate([{ $match: { codPending: true, reversedAt: null } }, { $group: { _id: null, paise: { $sum: '$salePaise' } } }])),
    ]);
    const commissionPaise = lines.commission ?? 0;
    const feesPaise = lines.fees ?? 0;
    return {
      totals: { commissionPaise, feesPaise, adsRevenuePaise: 0, netRevenuePaise: commissionPaise + feesPaise, refundsPaise: refunds.paise ?? 0, payoutsPaidPaise: paid.paise ?? 0, codOutstandingPaise: cod.paise ?? 0 },
    };
  },

  async marketing({ since }) {
    const t = await first(Order.aggregate([
      { $match: { placedAt: { $gte: since }, status: { $ne: 'CANCELLED' }, couponCode: { $ne: null } } },
      { $group: { _id: null, redemptions: { $sum: 1 }, discountPaise: { $sum: { $ifNull: ['$totals.couponDiscountPaise', 0] } }, gmvPaise: { $sum: { $ifNull: ['$totals.subtotalPaise', 0] } } } },
    ]));
    // flash sales, campaign open/click rates and referrals are not tracked yet
    return {
      totals: { couponRedemptions: t.redemptions ?? 0, couponDiscountGivenPaise: t.discountPaise ?? 0, couponNetGmvPaise: t.gmvPaise ?? 0, flashSaleGmvPaise: null },
      campaignPerformance: [],
      referralFunnel: [],
    };
  },

  async support() {
    // the support desk is not built: nothing to count yet
    return { notBuilt: true, totals: { ticketVolume: 0, avgFirstResponseMins: 0, avgResolutionHrs: 0, avgCsat: null, contactRatePct: 0 }, byChannel: [] };
  },
};

export const ANALYTICS_DOMAINS = Object.keys(BUILDERS);

export async function getDomainAnalytics(domain, days) {
  const { currentSince } = windows(days);
  return { domain, days, ...(await BUILDERS[domain]({ since: currentSince })) };
}
