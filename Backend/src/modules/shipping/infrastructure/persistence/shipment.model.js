import mongoose from 'mongoose';

// One parcel: a seller's part of an order (a sub-order) handed to a courier through Shiprocket. The provider ids are filled
// in as each Shiprocket step succeeds, so a half-finished "ready to ship" resumes where it stopped instead of starting over.
const shipmentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    subOrderId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    status: { type: String, enum: ['CREATING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'DELIVERED', 'RTO', 'RTO_DELIVERED'], default: 'CREATING' },
    pickupName: { type: String, default: null },
    shiprocketOrderId: { type: String, default: null },
    providerShipmentId: { type: String, default: null },
    awb: { type: String, default: null },
    courierName: { type: String, default: null },
    labelUrl: { type: String, default: null },
    pickupRequestedAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null }, // one "ready to ship" at a time per parcel
    events: [{ _id: false, status: String, providerStatus: String, location: String, at: Date }],
  },
  { collection: 'shipments', timestamps: true, versionKey: false },
);

shipmentSchema.index({ awb: 1 }, { unique: true, partialFilterExpression: { awb: { $type: 'string' } } });
shipmentSchema.index({ orderId: 1 });

export const Shipment = mongoose.models.Shipment ?? mongoose.model('Shipment', shipmentSchema);
