import mongoose from 'mongoose';
import { SUB } from '../../domain/services/orderStatus.js';

// A sub-order (one seller's parcel) moves on its own; the order's status follows its slowest live sub-order (orderStatus.js).
export const ORDER_STATUS = Object.freeze({ CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' });

const itemSchema = new mongoose.Schema(
  {
    offerId: mongoose.Schema.Types.ObjectId,
    productId: String,
    variantId: String,
    name: String,
    brand: String,
    category: String,
    variantLabel: String,
    imageUrl: String,
    quantity: Number,
    unitPricePaise: Number,
    mrpPaise: Number,
    amountPaise: Number,
    discountPaise: Number, // this line's share of the coupon
    hsnCode: String,
    gstRate: Number,
    gstPaise: Number, // inside what was paid, not on top
    commissionPct: Number,
    commissionPaise: Number,
    priceSource: String,
    returnWindowDays: Number, // the product's return policy when it was bought (0 = not returnable); a later edit never changes it
  },
  { _id: true },
);

const subOrderSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true },
    sellerName: String,
    status: { type: String, enum: Object.values(SUB), default: SUB.CONFIRMED },
    items: [itemSchema],
    itemsPaise: Number,
    discountPaise: Number,
    shippingPaise: Number,
    shippingDiscountPaise: Number,
    payablePaise: Number,
    codDuePaise: { type: Number, default: null }, // cash on delivery only: what the courier collects for this parcel (payable plus its share of the platform and COD fees)
    etaDays: Number,
    deliveredAt: { type: Date, default: null }, // starts the return window
    shippingSource: String,
    events: [{ _id: false, status: String, at: Date, actorType: String, actorId: String, note: String }],
  },
  { _id: true },
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    checkoutSessionId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, default: ORDER_STATUS.CONFIRMED },
    refundedPaise: { type: Number, default: 0 }, // money already sent back (all of it once every parcel is cancelled)
    address: { type: mongoose.Schema.Types.Mixed, required: true },
    couponCode: { type: String, default: null },
    totals: { type: mongoose.Schema.Types.Mixed, required: true },
    subOrders: [subOrderSchema],
    timeline: [{ _id: false, status: String, at: Date, note: String }],
    placedAt: { type: Date, default: Date.now },
    cancelReason: { type: String, default: null },
  },
  { collection: 'orders', timestamps: true, versionKey: false },
);

orderSchema.index({ customerId: 1, _id: -1 });

export const Order = mongoose.models.Order ?? mongoose.model('Order', orderSchema);
