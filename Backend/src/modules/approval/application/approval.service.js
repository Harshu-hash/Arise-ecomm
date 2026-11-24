import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { emitTo, rooms } from '../../../infrastructure/realtime/socket.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { userHasPermission } from '../../../shared/middleware/permission.js';
import { assertMakerChecker } from '../../../shared/policies/ownership.js';
import { User } from '../../identity/public/index.js';
import { ApprovalRequest } from '../infrastructure/persistence/approval.model.js';

// Maker-checker for money actions over an admin's own limit (their scope's refundLimit / walletAdjustLimit). Owning modules
// register what an approval runs; the action's route answers 202 with the request instead of doing it, and a different admin
// who may do that action decides. Unrestricted admins (no limit in their scope) never come here.

const actions = new Map();

/** `permission` is what an approver must hold to decide this kind; `run(payload, requester)` does the real work on approval. */
export function registerApprovalAction(kind, { permission, run }) {
  actions.set(kind, { permission, run });
}

const toDto = (row) => ({
  id: String(row._id),
  kind: row.kind,
  summary: row.summary,
  amountPaise: row.amountPaise,
  status: row.status,
  requestedBy: row.requestedBy,
  requestedByName: row.requestedByName,
  decidedBy: row.decidedBy,
  decidedAt: row.decidedAt?.toISOString() ?? null,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
});

const announce = (row) => emitTo(rooms.admin, 'approval:changed', { approvalId: String(row._id), status: row.status, at: new Date().toISOString() });

/** Files the request in place of the action. */
export async function requestApproval({ kind, summary, amountPaise = null, payload }, actor) {
  if (!actions.has(kind)) throw new AppError({ code: 'APPROVAL_KIND_UNKNOWN', status: 500, message: `No approval action is registered for ${kind}.` });
  const user = await User.findById(actor.userId, 'name email').lean();
  const row = await ApprovalRequest.create({ kind, summary, amountPaise, payload, requestedBy: String(actor.userId), requestedByName: user?.name || user?.email || null });
  await recordAudit({ action: 'approval.request', subjectType: 'approval', subjectId: row._id, after: { kind, summary, amountPaise }, actor });
  announce(row);
  return toDto(row);
}

export async function listApprovals({ status, page = 1, pageSize = 25 }) {
  const filter = status ? { status } : {};
  const [rows, total, byStatus] = await Promise.all([
    ApprovalRequest.find(filter).sort({ _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ApprovalRequest.countDocuments(filter),
    ApprovalRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  return { data: rows.map(toDto), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { status: Object.fromEntries(byStatus.map((entry) => [entry._id, entry.n])) } } };
}

/** Approve (runs the action as the requester, with the approver on the audit trail) or reject (a reason is required). */
export async function decideApproval(id, { decision, reason }, approver) {
  const row = await ApprovalRequest.findById(id);
  if (!row) throw new NotFoundError('That approval request does not exist.');
  if (row.status !== 'PENDING') throw new AppError({ code: 'APPROVAL_DECIDED', status: 409, message: `This request was already ${row.status.toLowerCase()}.` });
  assertMakerChecker(row.requestedBy, approver.userId);
  const action = actions.get(row.kind);
  if (!action) throw new AppError({ code: 'APPROVAL_KIND_UNKNOWN', status: 500, message: `No approval action is registered for ${row.kind}.` });
  if (!(await userHasPermission(approver.userId, action.permission))) throw new ForbiddenError('You may not decide this kind of request.');
  if (decision === 'REJECTED' && !reason?.trim()) throw new ValidationError('Say why this is rejected.', { reason: ['Say why this is rejected.'] });

  // claim it first, so two approvers clicking at once run it once
  const claimed = await ApprovalRequest.findOneAndUpdate({ _id: id, status: 'PENDING' }, { $set: { status: decision, decidedBy: String(approver.userId), decidedAt: new Date(), reason: reason?.trim() || null } }, { new: true });
  if (!claimed) throw new AppError({ code: 'APPROVAL_DECIDED', status: 409, message: 'This request was just decided by someone else.' });
  await recordAudit({ action: `approval.${decision === 'APPROVED' ? 'approve' : 'reject'}`, subjectType: 'approval', subjectId: id, after: { kind: row.kind, requestedBy: row.requestedBy }, reason, actor: approver });

  if (decision === 'APPROVED') {
    try {
      await action.run(row.payload, { userId: row.requestedBy, role: 'ADMIN' });
    } catch (error) {
      // the approval stands as a decision, but the action did not happen: say so rather than pretend
      const failed = await ApprovalRequest.findOneAndUpdate({ _id: id }, { $set: { status: 'FAILED', reason: error.message } }, { new: true });
      announce(failed);
      return toDto(failed);
    }
  }
  announce(claimed);
  return toDto(claimed);
}
