import mongoose from 'mongoose';

// One delivered order item's money, frozen when it was delivered (settlementRules.computeLine) and credited to the seller's wallet
// as pending. Only facts are stored; whether it is held by a return is worked out on every read. `releasedAt` moved it to
// available, `reversedAt` took it back after a refund.
const money = { type: Number, default: 0 };
const lineSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true }, // `${subOrderId}:${itemId}`: accruing twice makes no second line
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
    orderNumber: { type: String, required: true, immutable: true },
    subOrderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
    sellerId: { type: String, required: true, immutable: true },
    sellerName: String,
    productTitle: String,
    qty: Number,
    customerName: String,
    paymentMethod: String, // UPI | CARD | COD
    deliveredAt: { type: Date, required: true },
    returnWindowDays: Number,
    releaseAt: { type: Date, required: true }, // delivery + the item's return window + the settlement buffer
    codPending: { type: Boolean, default: false }, // cash on delivery: not releasable until the courier's cash reaches Arise
    codRemittedAt: { type: Date, default: null },
    salePaise: money,
    commissionPct: Number,
    commissionPaise: money,
    closingFeePaise: money,
    collectionFeePaise: money,
    feesBeforeTaxPaise: money,
    gstOnFeesPaise: money,
    tcsPaise: money,
    tdsPaise: money,
    netPaise: { type: Number, default: 0 },
    negative: { type: Boolean, default: false },
    releasedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    reverseReason: { type: String, default: null },
  },
  { collection: 'settlement_lines', timestamps: true, versionKey: false },
);

lineSchema.index({ sellerId: 1, deliveredAt: -1 });
lineSchema.index({ subOrderId: 1 });
lineSchema.index({ releasedAt: 1, reversedAt: 1, releaseAt: 1 });

export const SettlementLine = mongoose.models.SettlementLine ?? mongoose.model('SettlementLine', lineSchema);
