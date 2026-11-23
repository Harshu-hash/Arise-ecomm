import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { REVIEW_STATUS } from '../domain/services/reviewRules.js';
import { ReviewReport } from '../infrastructure/persistence/reviewReport.model.js';
import { tellCustomer } from './adminReview.service.js';
import { transition } from './review.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORT_FIELD = { reportedAt: 'createdAt', reporterCount: 'createdAt' }; // every row is one reporter, so a count sort is the date sort

const toRow = (report) => ({
  id: String(report._id),
  targetType: report.targetType,
  targetId: String(report.targetId),
  targetExcerpt: report.targetExcerpt,
  reason: report.reason,
  reporterCount: 1,
  reporterType: report.reporterType,
  reporterId: report.reporterId,
  sellerId: report.reporterType === 'SELLER' ? report.reporterId : null,
  status: report.status,
  decisionReason: report.decisionReason ?? null,
  reportedAt: report.createdAt.toISOString(),
});

export async function listAbuseReports(query) {
  const match = {};
  if (query.targetType) match.targetType = query.targetType;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    match.$or = [{ targetExcerpt: pattern }, { reason: pattern }];
  }
  const filter = query.status.length ? { ...match, status: { $in: query.status } } : match;
  const [rows, total, byStatus] = await Promise.all([
    ReviewReport.find(filter).sort({ [SORT_FIELD[query.sortField]]: query.sortDirection, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
    ReviewReport.countDocuments(filter),
    ReviewReport.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return {
    data: rows.map(toRow),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)), facets: { status: Object.fromEntries(byStatus.map((row) => [row._id, row.count])), targetType: { REVIEW: total } } },
  };
}

/** DISMISSED leaves the review alone; REMOVED takes it down (and out of the product's rating) and tells its author. */
export async function decideAbuseReport(reportId, { decision, reason }, actor) {
  const report = await ReviewReport.findOneAndUpdate({ _id: reportId, status: 'OPEN' }, { $set: { status: decision, decisionReason: reason ?? null, decidedAt: new Date() } }, { new: true }).lean();
  if (!report) {
    if (!(await ReviewReport.exists({ _id: reportId }))) throw new NotFoundError('That report no longer exists.');
    throw new ConflictError('ALREADY_DECIDED', 'This report has already been decided.');
  }
  if (decision === 'REMOVED') {
    await ReviewReport.updateMany({ targetId: report.targetId, status: 'OPEN' }, { $set: { status: 'REMOVED', decisionReason: reason ?? null, decidedAt: new Date() } }); // other reporters' flags on it are settled too
    const removed = await transition({ _id: report.targetId }, { status: REVIEW_STATUS.REJECTED, moderationReason: 'Removed following an abuse report' });
    if (removed) await tellCustomer(removed, 'it broke our review rules');
  }
  await recordAudit({ action: 'abuse.decide', subjectType: 'reviewReport', subjectId: reportId, before: { status: 'OPEN' }, after: { status: decision }, reason: reason ?? null, actor });
  return toRow(report);
}
