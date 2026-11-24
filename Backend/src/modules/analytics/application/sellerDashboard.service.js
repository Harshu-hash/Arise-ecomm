import { Seller } from '../../identity/public/index.js';
import { Order, Return } from '../../order/public/index.js';
import { Offer } from '../../product/public/index.js';
import { SellerWallet } from '../../settlement/public/index.js';
import { pct, windows } from '../domain/services/analyticsRules.js';
import { shipmentsSummary } from './sellerOperations.js';

// The seller's home: their last 30 days, what needs doing, and how the account is doing. Always scoped to the signed-in seller.

const DAYS = 30;
const first = async (promise) => (await promise)[0] ?? {};

const TIPS = [
  { id: 'tip-ads', title: 'Boost visibility with Sponsored Products', cta: 'Create a campaign', link: '/ads/new' },
  { id: 'tip-stock', title: 'Keep best-sellers in stock to avoid lost sales', cta: 'Review inventory', link: '/inventory' },
  { id: 'tip-listings', title: 'Add more listings to reach more buyers', cta: 'Add a product', link: '/listings/new' },
];

export async function getSellerSummary(sellerId) {
  const { currentSince } = windows(DAYS);
  const [seller, sales, parcels, listings, returnsPending, wallet, ops] = await Promise.all([
    Seller.findById(sellerId, 'storeName tier').lean(),
    first(Order.aggregate([
      { $match: { placedAt: { $gte: currentSince }, 'subOrders.sellerId': sellerId } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.sellerId': sellerId, 'subOrders.status': { $nin: ['CANCELLED', 'RTO_DELIVERED'] } } },
      { $group: { _id: null, gmvPaise: { $sum: { $ifNull: ['$subOrders.itemsPaise', 0] } }, orderIds: { $addToSet: '$_id' } } },
      { $project: { _id: 0, gmvPaise: 1, orders: { $size: '$orderIds' } } },
    ])),
    Order.aggregate([
      { $match: { placedAt: { $gte: currentSince }, 'subOrders.sellerId': sellerId } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.sellerId': sellerId } },
      { $project: { status: '$subOrders.status' } },
    ]),
    Offer.countDocuments({ sellerId, status: 'LIVE' }),
    Return.countDocuments({ sellerId, status: { $in: ['REQUESTED', 'RECEIVED'] } }), // waiting for the seller's decision or quality check
    SellerWallet.findById(sellerId, 'availablePaise').lean(),
    shipmentsSummary(sellerId, { since: currentSince, until: new Date() }),
  ]);

  const total = parcels.length;
  const cancelled = parcels.filter((p) => p.status === 'CANCELLED').length;
  const returned = await Return.countDocuments({ sellerId, createdAt: { $gte: currentSince } });
  const cancellationPct = pct(cancelled, total);
  const lateDispatchPct = ops.dispatched ? Number((100 - ops.dispatchSlaPct).toFixed(2)) : 0;
  return {
    store: { name: seller?.storeName ?? null, tier: seller?.tier ?? 'BRONZE', rating: null },
    kpis: {
      gmv30dPaise: sales.gmvPaise ?? 0,
      orders30d: sales.orders ?? 0,
      liveListings: listings,
      ordersToProcess: parcels.filter((p) => ['CONFIRMED', 'ACCEPTED'].includes(p.status)).length,
      returnsPending,
      payoutDuePaise: wallet?.availablePaise ?? 0,
    },
    accountHealth: {
      score: Math.max(0, Math.round(100 - cancellationPct * 3 - lateDispatchPct * 2)),
      cancellationPct,
      lateDispatchPct,
      returnPct: pct(returned, Math.max(total - cancelled, 1)),
    },
    documentWarnings: [], // document expiry dates are not collected yet
    tips: TIPS,
  };
}

const ACTOR = { SYSTEM: 'system', COURIER: 'courier', CUSTOMER: 'customer' };
const ACTOR_NAME = { system: 'Arise', courier: 'Courier', customer: 'Customer', seller: 'You' };

/** GET /dashboard/activity: the latest happenings on this seller's parcels, newest first. */
export async function getSellerActivity(sellerId, limit = 12) {
  const rows = await Order.aggregate([
    { $match: { 'subOrders.sellerId': sellerId } },
    { $sort: { placedAt: -1 } },
    { $limit: 40 },
    { $unwind: '$subOrders' },
    { $match: { 'subOrders.sellerId': sellerId } },
    { $unwind: '$subOrders.events' },
    { $project: { number: 1, subId: '$subOrders._id', status: '$subOrders.events.status', at: '$subOrders.events.at', actorType: '$subOrders.events.actorType' } },
    { $sort: { at: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row, i) => {
    const actorType = ACTOR[row.actorType] ?? 'seller';
    return {
      id: `${row.subId}:${row.status}:${i}`,
      at: row.at,
      title: `Order ${row.number} → ${String(row.status).replaceAll('_', ' ')}`,
      actorName: ACTOR_NAME[actorType],
      actorType,
      actorId: actorType,
      severity: ['CANCELLED', 'DELIVERY_FAILED', 'RTO'].includes(row.status) ? 'warning' : undefined,
    };
  });
}
