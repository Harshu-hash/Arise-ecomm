import mongoose from 'mongoose';

// A money action an admin could not do alone (it was over their limit). Another admin approves or rejects it; approving runs it.
const schema = new mongoose.Schema(
  {
    kind: { type: String, required: true, immutable: true }, // names the registered action, e.g. 'wallet.adjust'
    summary: { type: String, required: true, immutable: true },
    amountPaise: { type: Number, default: null, immutable: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true }, // what the action runs with
    requestedBy: { type: String, required: true, immutable: true },
    requestedByName: { type: String, default: null, immutable: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'FAILED'], default: 'PENDING' },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, default: null }, // why it was rejected, or what went wrong when approving
  },
  { collection: 'approval_requests', timestamps: true, versionKey: false },
);
schema.index({ status: 1, createdAt: -1 });

export const ApprovalRequest = mongoose.models.ApprovalRequest ?? mongoose.model('ApprovalRequest', schema);
