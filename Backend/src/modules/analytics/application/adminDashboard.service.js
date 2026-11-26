import { Seller, User } from '../../identity/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { Payment } from '../../payment/public/index.js';
import { Product } from '../../product/public/index.js';
import { Withdrawal, SellerWallet, SettlementLine } from '../../settlement/public/index.js';
import { deltaPct, fillDays, fulfilmentFunnel, pct, sum, TZ, windows } from '../domain/services/analyticsRules.js';

// The admin home: headline numbers for a window against the one before it, a daily trend, top lists, and what is waiting on someone.
// Everything is read live from orders, returns, payments and the like; nothing is stored for the dashboard itself.

const SELLING = ['ACTIVE', 'APPROVED'];
const LIVE_PARCEL = { $not: [{ $in: ['$subOrders.status', ['CANCELLED', 'RTO_DELIVERED']] }] }; // a parcel that was not cancelled or sent back
const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
const byKey = (rows) => new Map(rows.map(({ _id, ...row }) => [_id, row]));

// shortcut: fixed service levels (accept in a day, dispatch in two); move them into platform settings when ops wants to tune them.
const ACCEPT_SLA_MS = 24 * 3_600_000;
const DISPATCH_SLA_MS = 48 * 3_600_000;

const dailyOrders = (since) => Order.aggregate([
  { $match: { placedAt: { $gte: since } } },
  { $unwind: '$subOrders' },
  {
    $group: {
      _id: day('$placedAt'),
      parcels: { $sum: 1 },
      gmvPaise: { $sum: { $cond: [LIVE_PARCEL, { $ifNull: ['$subOrders.itemsPaise', 0] }, 0] } },
      units: { $sum: { $cond: [LIVE_PARCEL, { $sum: '$subOrders.items.quantity' }, 0] } },
      cancellations: { $sum: { $cond: [{ $eq: ['$subOrders.status', 'CANCELLED'] }, 1, 0] } },
      orderIds: { $addToSet: { $cond: [LIVE_PARCEL, '$_id', null] } },
    },
  },
  { $project: { parcels: 1, gmvPaise: 1, units: 1, cancellations: 1, orders: { $size: { $setDifference: ['$orderIds', [null]] } } } },
]);

const dailyCount = (Model, match, field = 'createdAt') => Model.aggregate([{ $match: match }, { $group: { _id: day(`$${field}`), count: { $sum: 1 } } }]);

/** Top five by sales over live parcels: `key` and `label` are Mongo expressions over the unwound parcel and its item. */
const topBy = (since, key, label) => Order.aggregate([
  { $match: { placedAt: { $gte: since } } },
  { $unwind: '$subOrders' },
  { $match: { 'subOrders.status': { $nin: ['CANCELLED', 'RTO_DELIVERED'] } } },
  { $unwind: '$subOrders.items' },
  { $group: { _id: key, label: { $first: label }, gmvPaise: { $sum: '$subOrders.items.amountPaise' }, units: { $sum: '$subOrders.items.quantity' } } },
  { $match: { _id: { $ne: null } } },
  { $sort: { gmvPaise: -1 } },
  { $limit: 5 },
  { $project: { _id: 0, key: { $toString: '$_id' }, label: { $ifNull: ['$label', 'Unknown'] }, gmvPaise: 1, units: 1 } },
]);

const METHOD_LABEL = { upi: 'UPI', card: 'Card', cod: 'Cash on delivery' };

async function paymentMix(since) {
  const rows = await Payment.aggregate([
    { $match: { createdAt: { $gte: since }, status: { $in: ['SUCCEEDED', 'COD_PENDING', 'FAILED'] } } },
    { $group: { _id: '$method', ok: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 0, 1] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } } } },
  ]);
  const total = sum(rows, 'ok');
  return rows.map((row) => ({ method: METHOD_LABEL[row._id] ?? row._id, sharePct: pct(row.ok, total), successPct: pct(row.ok, row.ok + row.failed) })).sort((a, b) => b.sharePct - a.sharePct);
}

const topStates = (since) => Order.aggregate([
  { $match: { placedAt: { $gte: since }, status: { $ne: 'CANCELLED' } } },
  { $group: { _id: '$address.state', orders: { $sum: 1 }, gmvPaise: { $sum: { $ifNull: ['$totals.subtotalPaise', 0] } } } },
  { $match: { _id: { $ne: null } } },
  { $sort: { orders: -1 } },
  { $limit: 5 },
  { $project: { _id: 0, state: '$_id', orders: 1, gmvPaise: 1 } },
]);

/** GET /dashboard/summary: `days` days of headline numbers, each compared with the days before. */
export async function getSummary({ days, showFinance }) {
  const w = windows(days);
  const [orderRows, customerRows, returnRows, activeSellers, liveListings, commission, mix, states, categories, sellers, products, parcelCounts] = await Promise.all([
    dailyOrders(w.since),
    dailyCount(User, { role: 'CUSTOMER', createdAt: { $gte: w.since } }),
    dailyCount(Return, { createdAt: { $gte: w.since } }),
    Seller.countDocuments({ status: { $in: SELLING } }),
    Product.countDocuments({ status: 'LIVE' }),
    showFinance ? SettlementLine.aggregate([{ $match: { deliveredAt: { $gte: w.since }, reversedAt: null } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt', timezone: TZ } }, commissionPaise: { $sum: { $add: ['$commissionPaise', '$feesBeforeTaxPaise'] } } } }]) : [],
    showFinance ? paymentMix(w.currentSince) : [],
    topStates(w.currentSince),
    topBy(w.currentSince, '$subOrders.items.category', '$subOrders.items.category'),
    topBy(w.currentSince, '$subOrders.sellerId', '$subOrders.sellerName'),
    topBy(w.currentSince, '$subOrders.items.productId', '$subOrders.items.name'),
    Order.aggregate([{ $match: { placedAt: { $gte: w.currentSince } } }, { $unwind: '$subOrders' }, { $group: { _id: '$subOrders.status', n: { $sum: 1 } } }]),
  ]);

  const orders = byKey(orderRows);
  const customers = byKey(customerRows);
  const returns = byKey(returnRows);
  const earned = byKey(commission);
  const rows = new Map();
  for (const key of [...w.previous, ...w.current]) {
    rows.set(key, { ...orders.get(key), newCustomers: customers.get(key)?.count ?? 0, returns: returns.get(key)?.count ?? 0, netRevenuePaise: earned.get(key)?.commissionPaise ?? 0 });
  }
  const empty = { parcels: 0, gmvPaise: 0, units: 0, cancellations: 0, orders: 0, newCustomers: 0, returns: 0, netRevenuePaise: 0 };
  const series = fillDays(w.current, rows, empty);
  const previousSeries = fillDays(w.previous, rows, empty);
  const cur = Object.fromEntries(Object.keys(empty).map((key) => [key, sum(series, key)]));
  const prev = Object.fromEntries(Object.keys(empty).map((key) => [key, sum(previousSeries, key)]));
  const aov = (t) => (t.orders ? Math.round(t.gmvPaise / t.orders) : 0);
  const rate = (t, key) => pct(t[key], key === 'returns' ? Math.max(t.units, 1) : Math.max(t.parcels, 1));
  const kpi = (key, label, format, value, previous, extra = {}) => ({
    key, label, format, ...(format === 'money' ? { valuePaise: value } : { value }), deltaPct: deltaPct(value, previous), ...extra,
  });

  const counts = Object.fromEntries(parcelCounts.map((row) => [row._id, row.n]));
  return {
    range: { days, from: w.current[0], to: w.current.at(-1) },
    kpis: [
      kpi('gmv', 'GMV', 'money', cur.gmvPaise, prev.gmvPaise),
      ...(showFinance ? [kpi('netRevenue', 'Net revenue', 'money', cur.netRevenuePaise, prev.netRevenuePaise)] : []),
      kpi('orders', 'Orders', 'number', cur.orders, prev.orders),
      kpi('units', 'Units', 'number', cur.units, prev.units),
      kpi('aov', 'AOV', 'money', aov(cur), aov(prev)),
      kpi('newCustomers', 'New customers', 'number', cur.newCustomers, prev.newCustomers),
      kpi('cancellationPct', 'Cancellation rate', 'percent', pct(cur.cancellations, cur.parcels), pct(prev.cancellations, prev.parcels), { invertDelta: true }),
      kpi('returnPct', 'Return rate', 'percent', rate(cur, 'returns'), rate(prev, 'returns'), { invertDelta: true }),
      kpi('activeSellers', 'Active sellers', 'number', activeSellers, 0),
      kpi('liveListings', 'Live listings', 'number', liveListings, 0),
    ],
    series: series.map(({ parcels, netRevenuePaise, ...day_ }) => day_),
    previousSeries: previousSeries.map(({ parcels, netRevenuePaise, ...day_ }) => day_),
    paymentMix: mix,
    topStates: states,
    topCategories: categories,
    topSellers: sellers,
    topProducts: products,
    funnel: fulfilmentFunnel(counts),
  };
}

const count = (Model, match) => Model.countDocuments(match);

/** GET /dashboard/action-center: what is waiting on someone, each with the list it links to. Tiles the caller may not open are dropped by `allowed`. */
export async function getActionCenter(allowed) {
  const now = Date.now();
  const stale = (status, ms) => Order.aggregate([
    { $unwind: '$subOrders' },
    { $match: { 'subOrders.status': status, 'subOrders.events.0.at': { $lt: new Date(now - ms) } } },
    { $count: 'n' },
  ]).then(([row]) => row?.n ?? 0);
  const [applications, qc, notAccepted, notDispatched, awaitingQc, failedRefunds, withdrawals] = await Promise.all([
    count(Seller, { status: 'UNDER_REVIEW' }),
    count(Product, { status: 'QC_PENDING' }),
    stale('CONFIRMED', ACCEPT_SLA_MS),
    stale('ACCEPTED', DISPATCH_SLA_MS),
    count(Return, { status: 'RECEIVED' }),
    count(Return, { 'refund.status': 'FAILED' }),
    count(Withdrawal, { status: 'REQUESTED' }),
  ]);
  // [key, label, count, link, permission needed, urgent when above zero]
  const tiles = [
    ['sellerApplicationsPending', 'Seller applications pending', applications, '/sellers/applications', 'sellers.application.view', false],
    ['listingsInQc', 'Listings in QC', qc, '/catalog/products?status=QC_PENDING', 'catalog.product.approve', false],
    ['ordersNotAccepted', 'Not accepted past SLA', notAccepted, '/orders?status=CONFIRMED&slaBreached=true', 'orders.order.view', true],
    ['notDispatched', 'Not dispatched past SLA', notDispatched, '/orders?status=PROCESSING&slaBreached=true', 'orders.order.view', true],
    ['returnsAwaitingQc', 'Returns awaiting QC', awaitingQc, '/returns?status=RECEIVED', 'orders.return.view', false],
    ['failedRefunds', 'Failed refunds', failedRefunds, '/finance/refunds?status=FAILED', 'finance.refund.view', true],
    ['withdrawalsAwaitingApproval', 'Withdrawals to approve', withdrawals, '/finance/withdrawals', 'finance.payout.view', false],
  ];
  return tiles
    .filter(([, , , , permission]) => allowed(permission))
    .map(([key, label, n, link, permission, urgent]) => ({ key, label, count: n, link, permission, urgent: urgent && n > 0 }));
}

/** GET /finance/overview: who is owed what right now, kept apart on purpose (a healthy-looking net can hide money stuck with a courier). */
export async function getMoneyPosition() {
  const [wallets, lines, refunds, failed] = await Promise.all([
    SellerWallet.aggregate([{ $group: { _id: null, pending: { $sum: '$pendingPaise' }, available: { $sum: '$availablePaise' }, locked: { $sum: '$lockedPaise' } } }]),
    SettlementLine.aggregate([
      { $match: { reversedAt: null } },
      { $group: { _id: null, commission: { $sum: '$commissionPaise' }, tcs: { $sum: '$tcsPaise' }, tds: { $sum: '$tdsPaise' }, cod: { $sum: { $cond: ['$codPending', '$salePaise', 0] } } } },
    ]),
    Return.aggregate([{ $match: { 'refund.status': { $in: ['PENDING', 'PROCESSING'] } } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }]),
    count(Return, { 'refund.status': 'FAILED' }),
  ]);
  const w = wallets[0] ?? {};
  const l = lines[0] ?? {};
  return {
    payableNowPaise: w.available ?? 0,
    refundsPendingPaise: refunds[0]?.paise ?? 0,
    walletLiabilityPaise: (w.pending ?? 0) + (w.available ?? 0) + (w.locked ?? 0),
    giftCardLiabilityPaise: 0, // gift cards are not built
    codOutstandingPaise: l.cod ?? 0,
    heldPaise: w.pending ?? 0,
    commissionPaise: l.commission ?? 0,
    tcsPaise: l.tcs ?? 0,
    tdsPaise: l.tds ?? 0,
    refundsFailedCount: failed,
  };
}
