import mongoose from 'mongoose';

// An admin-made rule: a delivered parcel worth at least `minOrderPaise` earns `pct`% back as wallet credit, up to `maxCashbackPaise`.
// When several rules fit, the customer gets the best one (not all). `budgetPaise` (0 = no cap) stops a rule once it has paid that much.
const cashbackRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    pct: { type: Number, required: true, min: 1, max: 100 },
    maxCashbackPaise: { type: Number, required: true, min: 100 },
    minOrderPaise: { type: Number, default: 0, min: 0 },
    creditExpiryDays: { type: Number, default: 0, min: 0 }, // 0: the credit never expires
    budgetPaise: { type: Number, default: 0, min: 0 },
    usedPaise: { type: Number, default: 0 },
    grants: { type: Number, default: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    paused: { type: Boolean, default: false },
    createdBy: { type: String, default: null, immutable: true },
  },
  { collection: 'cashbackRules', timestamps: true, versionKey: false },
);

cashbackRuleSchema.index({ paused: 1, startsAt: 1, endsAt: 1 });

export const CashbackRule = mongoose.models.CashbackRule ?? mongoose.model('CashbackRule', cashbackRuleSchema);
