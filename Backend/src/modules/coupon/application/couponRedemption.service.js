import { Coupon } from '../infrastructure/persistence/coupon.model.js';
import { OrderCouponRecord, RECORD_STATUS } from '../infrastructure/persistence/orderCouponRecord.model.js';

const DUPLICATE_KEY = 11000;

/**
 * A customer's history for judging coupons: how many orders they have (cancelled ones do not count) and how many times
 * each coupon was used. Returns { ordersCount, redeemed: Map(couponId -> times) }.
 */
export async function getCustomerCouponHistory(customerId) {
  const rows = await OrderCouponRecord.aggregate([
    { $match: { customerId: String(customerId), status: RECORD_STATUS.ACTIVE } },
    { $group: { _id: '$couponId', orders: { $sum: 1 } } },
  ]);
  return {
    ordersCount: rows.reduce((sum, row) => sum + row.orders, 0),
    redeemed: new Map(rows.filter((row) => row._id).map((row) => [String(row._id), row.orders])),
  };
}

/**
 * An order was placed: remembers it for the customer's history and, when a coupon was used, counts the redemption against
 * the coupon's limit and budget. Call inside the order's transaction (`session`); repeating for the same order does nothing.
 */
export async function recordOrderPlaced({ orderId, customerId, couponCode, discountPaise }, session) {
  const coupon = couponCode ? await Coupon.findOne({ code: couponCode }, '_id').session(session).lean() : null;
  try {
    await OrderCouponRecord.create([{ orderId, customerId: String(customerId), couponId: coupon?._id ?? null, code: couponCode ?? null, discountPaise }], { session });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) return;
    throw error;
  }
  if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { totalRedemptions: 1, budgetUsedPaise: discountPaise } }, { session });
}

/** The order was cancelled: gives the coupon use back (limit and budget) and the customer's "first order" status. Safe to repeat. */
export async function reverseOrderPlaced({ orderId }, session) {
  const record = await OrderCouponRecord.findOneAndUpdate({ orderId, status: RECORD_STATUS.ACTIVE }, { $set: { status: RECORD_STATUS.REVERSED } }, { session });
  if (record?.couponId) await Coupon.updateOne({ _id: record.couponId }, { $inc: { totalRedemptions: -1, budgetUsedPaise: -record.discountPaise } }, { session });
}
