import mongoose from 'mongoose';

export const CATEGORY = Object.freeze({ ORDER: 'ORDER', DELIVERY: 'DELIVERY', OFFER: 'OFFER', ACCOUNT: 'ACCOUNT', SUPPORT: 'SUPPORT' });

// One in-app message for one customer or seller. `deduplicationKey` names the event it is about (e.g. "sub:<id>:SHIPPED"), so
// an event that is processed twice produces one message. Sellers' rows are what their panel's header bell shows.
const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: ['CUSTOMER', 'SELLER'], required: true, immutable: true },
    recipientId: { type: String, required: true, immutable: true },
    category: { type: String, enum: Object.values(CATEGORY), required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    deduplicationKey: { type: String, required: true, immutable: true },
    target: {
      type: { type: String, enum: ['NONE', 'PRODUCT', 'ORDER', 'SHIPMENT', 'TICKET'], default: 'NONE' },
      entityId: { type: String, default: null },
    },
    severity: { type: String, enum: ['info', 'warning', 'error'], default: 'info' }, // seller bell
    link: { type: String, default: null }, // seller panel route
    readAt: { type: Date, default: null },
  },
  { collection: 'notifications', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

notificationSchema.index({ recipientType: 1, recipientId: 1, deduplicationKey: 1 }, { unique: true });
notificationSchema.index({ recipientType: 1, recipientId: 1, _id: -1 });

export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
