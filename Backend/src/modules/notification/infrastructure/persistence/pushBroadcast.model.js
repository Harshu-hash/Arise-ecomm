import mongoose from 'mongoose';

export const BROADCAST_STATUS = Object.freeze({ SCHEDULED: 'SCHEDULED', SENDING: 'SENDING', SENT: 'SENT', FAILED: 'FAILED', CANCELLED: 'CANCELLED', EXPIRED: 'EXPIRED' });

// A marketing message an admin sent (or scheduled) to every customer and/or seller. Delivery fills the counters.
const broadcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 65 },
    message: { type: String, required: true, maxlength: 240 },
    campaignName: { type: String, required: true, maxlength: 120 },
    imageUrl: { type: String, default: null },
    deepLink: { type: String, default: null },
    audiences: { type: [String], enum: ['CUSTOMERS', 'SELLERS'], required: true },
    platforms: { type: [String], enum: ['ANDROID', 'IOS'], required: true }, // which phones get the push; the in-app message goes to everyone
    priority: { type: String, enum: ['NORMAL', 'HIGH'], default: 'NORMAL' },
    sound: { type: Boolean, default: true },
    collapseKey: { type: String, default: null },
    scheduleAt: { type: Date, default: null }, // when it goes out (set to now for "send now")
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: Object.values(BROADCAST_STATUS), default: BROADCAST_STATUS.SCHEDULED },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: null },
    sentAt: { type: Date, default: null },
    inboxCount: { type: Number, default: 0 }, // customers and sellers who got it in their notification list
    pushSent: { type: Number, default: 0 },
    pushFailed: { type: Number, default: 0 },
    failureReason: { type: String, default: null },
  },
  { collection: 'push_broadcasts', timestamps: true, versionKey: false },
);
broadcastSchema.index({ status: 1, scheduleAt: 1 });
broadcastSchema.index({ createdAt: -1 });

export const PushBroadcast = mongoose.models.PushBroadcast ?? mongoose.model('PushBroadcast', broadcastSchema);
