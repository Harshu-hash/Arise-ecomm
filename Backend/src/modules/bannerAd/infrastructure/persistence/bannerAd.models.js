import mongoose from 'mongoose';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../domain/bannerAdRules.js';

// An admin-defined, separately priced banner position that sellers rent by the day.
const slotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true }, // lower-cased name: slot names are unique ignoring case
    description: { type: String, trim: true, maxlength: 300, default: '' },
    dailyRatePaise: { type: Number, required: true, min: 1 },
    mobileWidth: { type: Number, required: true },
    mobileHeight: { type: Number, required: true },
    // The customer-app page this slot's carousel appears on: a header category's page, or null for the main For You page.
    categoryId: { type: mongoose.Schema.Types.ObjectId, default: null },
    categoryName: { type: String, default: null }, // snapshot of the label, so a deactivated category still reads right
    enabled: { type: Boolean, default: true },
    version: { type: Number, min: 1, default: 1 },
  },
  { collection: 'banner_slots', timestamps: true, versionKey: false },
);
slotSchema.index({ nameKey: 1 }, { unique: true });

const creativeSchema = new mongoose.Schema(
  { mediaId: String, key: String, fileName: String, width: Number, height: Number },
  { _id: false },
);

// One seller's paid rental of a slot for a date range. Slot name/price/sizes are snapshotted so later
// admin edits never change what was bought.
const bookingSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true },
    sellerName: { type: String, default: null },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'BannerSlot', required: true },
    slotName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, default: null }, // the slot's page when booked
    categoryName: { type: String, default: null },
    campaignName: { type: String, required: true, trim: true, maxlength: 80 },
    destinationType: { type: String, enum: ['SHOP', 'PRODUCT'], required: true },
    destinationValue: { type: String, required: true },
    startsOn: { type: String, required: true }, // YYYY-MM-DD, India calendar days
    endsOn: { type: String, required: true },
    mobileCreative: { type: creativeSchema, required: true },
    days: { type: Number, required: true },
    dailyRatePaise: { type: Number, required: true },
    subtotalPaise: { type: Number, required: true },
    gstPct: { type: Number, required: true },
    gstPaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true },
    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.PENDING_PAYMENT },
    holdExpiresAt: { type: Date, default: null },
    payment: {
      status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
      providerOrderId: { type: String, default: null },
      providerPaymentId: { type: String, default: null },
      refundId: { type: String, default: null },
      paidAt: { type: Date, default: null },
    },
    submittedAt: { type: Date, default: null }, // when it entered the review queue (= paid)
    rejectionReason: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: String, default: null },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { collection: 'banner_bookings', timestamps: true, versionKey: false },
);
bookingSchema.index({ sellerId: 1, createdAt: -1 });
bookingSchema.index({ slotId: 1, status: 1 });
bookingSchema.index({ status: 1, submittedAt: -1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.index({ 'payment.providerOrderId': 1 }, { unique: true, sparse: true });

// One row per slot per held day. The unique index is what makes double booking impossible even when
// two sellers submit at the same instant: Mongo has no range constraint, so each day is its own key.
const dayLockSchema = new mongoose.Schema(
  {
    slotId: { type: mongoose.Schema.Types.ObjectId, required: true },
    day: { type: String, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { collection: 'banner_slot_days', versionKey: false },
);
dayLockSchema.index({ slotId: 1, day: 1 }, { unique: true });
dayLockSchema.index({ bookingId: 1 });

export const BannerSlot = mongoose.models.BannerSlot ?? mongoose.model('BannerSlot', slotSchema);
export const BannerBooking = mongoose.models.BannerBooking ?? mongoose.model('BannerBooking', bookingSchema);
export const BannerSlotDay = mongoose.models.BannerSlotDay ?? mongoose.model('BannerSlotDay', dayLockSchema);
