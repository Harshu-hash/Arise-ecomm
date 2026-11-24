import { Order } from '../../order/public/index.js';
import { pct } from '../domain/services/analyticsRules.js';

// shortcut: a fixed two-day dispatch promise; read it from platform settings when it becomes configurable.
const DISPATCH_SLA_MS = 48 * 3_600_000;

/** How this seller's parcels in the window got out the door: dispatched on time, failed deliveries (NDR), sent back (RTO). */
export async function shipmentsSummary(sellerId, period) {
  const parcels = await Order.aggregate([
    { $match: { placedAt: { $gte: period.since, $lt: period.until }, 'subOrders.sellerId': sellerId } },
    { $unwind: '$subOrders' },
    { $match: { 'subOrders.sellerId': sellerId } },
    {
      $project: {
        status: '$subOrders.status',
        confirmedAt: { $arrayElemAt: ['$subOrders.events.at', 0] },
        readyAt: { $min: { $map: { input: { $filter: { input: '$subOrders.events', cond: { $eq: ['$$this.status', 'READY_TO_SHIP'] } } }, in: '$$this.at' } } },
        failedDelivery: { $in: ['DELIVERY_FAILED', '$subOrders.events.status'] },
      },
    },
  ]);
  const dispatched = parcels.filter((parcel) => parcel.readyAt);
  const onTime = dispatched.filter((parcel) => parcel.readyAt - parcel.confirmedAt <= DISPATCH_SLA_MS).length;
  return {
    dispatched: dispatched.length,
    dispatchSlaPct: pct(onTime, dispatched.length),
    ndr: parcels.filter((parcel) => parcel.failedDelivery).length,
    rto: parcels.filter((parcel) => ['RTO', 'RTO_DELIVERED'].includes(parcel.status)).length,
  };
}
