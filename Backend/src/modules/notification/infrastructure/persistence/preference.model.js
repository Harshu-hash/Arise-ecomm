import mongoose from 'mongoose';

// What a customer wants pushes for. Turning a category off stops its pushes; the in-app list still shows everything, and
// order emails are receipts, so they are always sent.
const preferenceSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, immutable: true },
    orders: { type: Boolean, default: true },
    delivery: { type: Boolean, default: true },
    offers: { type: Boolean, default: true },
    account: { type: Boolean, default: true },
    support: { type: Boolean, default: true },
    pushPermission: { type: String, enum: ['NOT_DETERMINED', 'GRANTED', 'DENIED'], default: 'NOT_DETERMINED' },
  },
  { collection: 'notification_preferences', timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

export const Preference = mongoose.models.NotificationPreference ?? mongoose.model('NotificationPreference', preferenceSchema);
