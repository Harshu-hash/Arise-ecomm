import mongoose from 'mongoose';

// A seller's wallet: three balances that are only ever changed together with the ledger rows that explain them (wallet.service.post).
// pending = earned, inside the return window; available = released; locked = reserved for withdrawals not yet paid.
// available may go negative (a return after the money was withdrawn): the seller owes it, and new earnings pay it off.
const walletSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // the seller id
    pendingPaise: { type: Number, default: 0 },
    availablePaise: { type: Number, default: 0 },
    lockedPaise: { type: Number, default: 0 },
    lifetimeEarnedPaise: { type: Number, default: 0 },
    lifetimeWithdrawnPaise: { type: Number, default: 0 },
  },
  { collection: 'seller_wallets', timestamps: true, versionKey: false },
);

export const SellerWallet = mongoose.models.SellerWallet ?? mongoose.model('SellerWallet', walletSchema);

// The append-only ledger: one row moves one balance by a signed amount. `key` (`<event>:<bucket>`) makes every event safe to repeat.
// Internal moves (release, lock) are two rows that cancel; money entering or leaving the wallet (earning, reversal, payout,
// adjustment) is one row. The wallet always equals the sum of its rows per bucket.
const entrySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true },
    type: { type: String, enum: ['EARNING', 'RELEASE', 'RETURN_REVERSAL', 'WITHDRAWAL_LOCK', 'WITHDRAWAL_UNLOCK', 'WITHDRAWAL_PAID', 'ADJUSTMENT', 'COD_REMITTED'], required: true },
    bucket: { type: String, enum: ['pending', 'available', 'locked'], required: true },
    deltaPaise: { type: Number, required: true },
    refType: { type: String, default: null }, // LINE | WITHDRAWAL | ADJUSTMENT
    refId: { type: String, default: null },
    orderNumber: { type: String, default: null },
    note: { type: String, default: null },
    actorId: { type: String, default: null },
  },
  { collection: 'wallet_entries', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

entrySchema.index({ sellerId: 1, _id: -1 });
entrySchema.index({ refType: 1, refId: 1 });

export const WalletEntry = mongoose.models.WalletEntry ?? mongoose.model('WalletEntry', entrySchema);

const withdrawalSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, immutable: true },
    sellerId: { type: String, required: true, immutable: true, index: true },
    sellerName: String,
    amountPaise: { type: Number, required: true, immutable: true },
    status: { type: String, enum: ['REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'], default: 'REQUESTED' },
    bank: { holder: String, last4: String, ifsc: String, bankName: String }, // snapshot: a later bank edit never redirects an approved request
    requestedById: String,
    approvedById: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    paidById: { type: String, default: null },
    paidAt: { type: Date, default: null },
    txnNo: { type: String, default: '' }, // the bank / UPI transaction number the admin recorded
    utr: { type: String, default: '' },
    decisionReason: { type: String, default: null }, // why it was rejected
    events: [{ _id: false, status: String, at: Date, actorType: String, actorId: String, note: String }],
  },
  { collection: 'withdrawals', timestamps: true, versionKey: false },
);

withdrawalSchema.index({ status: 1, createdAt: -1 });
withdrawalSchema.index({ sellerId: 1, createdAt: -1 });

export const Withdrawal = mongoose.models.Withdrawal ?? mongoose.model('Withdrawal', withdrawalSchema);
export const SettlementCounter = mongoose.models.SettlementCounter ?? mongoose.model('SettlementCounter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { collection: 'settlement_counters', versionKey: false }));
