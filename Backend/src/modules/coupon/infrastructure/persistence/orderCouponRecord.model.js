import mongoose from 'mongoose';

export const RECORD_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', REVERSED: 'REVERSED' });

// One row per placed order: what it did to coupons. It is the customer's order history for "new customer" coupons
// (count of ACTIVE rows) and the per-customer redemption count (ACTIVE rows with a couponId). A cancelled order is REVERSED,
// so its coupon use is given back and it no longer makes the customer "not new".
const schema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    code: { type: String, default: null, immutable: true },
    discountPaise: { type: Number, default: 0, immutable: true },
    status: { type: String, enum: Object.values(RECORD_STATUS), default: RECORD_STATUS.ACTIVE },
  },
  { collection: 'order_coupon_records', timestamps: true, versionKey: false },
);

schema.index({ customerId: 1, status: 1, couponId: 1 });

export const OrderCouponRecord = mongoose.models.OrderCouponRecord ?? mongoose.model('OrderCouponRecord', schema);
