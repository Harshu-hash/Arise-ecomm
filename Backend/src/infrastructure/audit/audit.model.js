import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actorId: { type: String, default: null, immutable: true },
    actorRole: { type: String, default: null, immutable: true },
    sellerId: { type: String, default: null, immutable: true },
    action: { type: String, required: true, immutable: true }, // e.g. seller.approved
    subjectType: { type: String, required: true, immutable: true },
    subjectId: { type: String, required: true, immutable: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
    after: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
    reason: { type: String, default: null, immutable: true },
    requestId: { type: String, default: null, immutable: true },
    ip: { type: String, default: null, immutable: true },
    userAgent: { type: String, default: null, immutable: true },
  },
  { collection: 'auditLogs', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ sellerId: 1, createdAt: -1 });

// Append-only: any mutation through Mongoose is rejected. (DB users should also lack update/delete on this collection.)
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  auditSchema.pre(op, () => {
    throw new Error('Audit logs are append-only');
  });
}

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditSchema);
