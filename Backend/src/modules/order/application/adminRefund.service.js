import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { Payment, refundPayment } from '../../payment/public/index.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { settleReturn } from './returnSettlement.service.js';

// The admin Refunds page. A refund is one entry on a payment (one per cancelled parcel, returned item or sent-back parcel): its id here is
// `<paymentId>:<key>`. Refunds go back to the original payment method; wallet and bank refunds are not built.

const DAY_MS = 86_400_000;
const PROMISE_DAYS = 7; // the refund promise shown to the customer
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csv = (value) => (value ? String(value).split(',').filter(Boolean) : []);
const SORTS = { initiatedAt: 'initiatedAt', amountPaise: 'refund.amountPaise', status: 'status', ageDays: 'initiatedAt' };

const typeOf = (key) => (key.startsWith('return:') ? 'RETURN' : 'CANCELLATION'); // cancelled parcels, sent-back parcels and unfulfillable orders
const refundId = (paymentId, key) => `${paymentId}:${key}`;

// Flatten the refund entries of payments, with their order, and work out what the page shows for each.
const refundRows = [
  { $match: { 'refunds.0': { $exists: true } } },
  { $unwind: '$refunds' },
  { $lookup: { from: Order.collection.name, localField: 'orderId', foreignField: '_id', as: 'order' } },
  { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      status: { $switch: { branches: [{ case: { $eq: ['$refunds.status', 'SUCCEEDED'] }, then: 'COMPLETED' }, { case: { $eq: ['$refunds.status', 'FAILED'] }, then: 'FAILED' }], default: 'PROCESSING' } },
      type: { $cond: [{ $regexMatch: { input: '$refunds.key', regex: '^return:' } }, 'RETURN', 'CANCELLATION'] },
      initiatedAt: { $ifNull: ['$refunds.initiatedAt', '$updatedAt'] }, // older entries did not record when they were asked for
    },
  },
];

const withSla = (now) => ({
  $addFields: {
    ageDays: { $floor: { $divide: [{ $subtract: [now, '$initiatedAt'] }, DAY_MS] } },
    slaBreached: { $and: [{ $ne: ['$status', 'COMPLETED'] }, { $gt: [{ $subtract: [now, '$initiatedAt'] }, PROMISE_DAYS * DAY_MS] }] },
  },
});

function toRow(doc) {
  return {
    id: refundId(doc._id, doc.refunds.key),
    orderId: doc.order?.number ?? null,
    customerName: doc.order?.address?.name ?? '—',
    paymentMethod: doc.method.toUpperCase(),
    amountPaise: doc.refunds.amountPaise,
    type: doc.type,
    mode: 'ORIGINAL',
    status: doc.status,
    failureReason: doc.refunds.failureReason ?? null,
    arn: null, // the bank's acquirer reference is not collected
    initiatedAt: doc.initiatedAt.toISOString(),
    ageDays: doc.ageDays,
    slaBreached: doc.slaBreached,
  };
}

async function matchOf(query, now) {
  const from = query['initiatedAt[gte]'];
  const to = query['initiatedAt[lte]'];
  const types = csv(query.type).filter((type) => ['RETURN', 'CANCELLATION'].includes(type));
  const statuses = csv(query.status).filter((status) => ['COMPLETED', 'FAILED', 'PROCESSING'].includes(status));
  const and = [];
  if (query.status && !statuses.length) and.push({ _id: null }); // a tab that does not exist here (awaiting details, initiated) is empty
  if (query.type && !types.length) and.push({ _id: null });
  if (query.mode && query.mode !== 'ORIGINAL') and.push({ _id: null }); // only refunds to the original payment exist
  if (query.q) {
    const search = new RegExp(escapeRegex(query.q), 'i');
    and.push({ $or: [{ 'order.number': search }, { 'order.address.name': search }, { 'refunds.providerRefundId': search }, { 'refunds.key': search }, ...(mongoose.isValidObjectId(query.q) ? [{ _id: new mongoose.Types.ObjectId(query.q) }] : [])] });
  }
  return {
    ...(statuses.length ? { status: { $in: statuses } } : {}),
    ...(types.length ? { type: { $in: types } } : {}),
    ...(query.slaBreached === 'true' ? { slaBreached: true } : {}),
    ...(from || to ? { initiatedAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
    ...(and.length ? { $and: and } : {}),
  };
}

export async function listAdminRefunds(query) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 25)));
  const sort = query.sort || '-initiatedAt';
  const field = SORTS[sort.replace(/^-/, '')] ?? 'initiatedAt';
  const direction = sort.startsWith('-') || !SORTS[sort] ? -1 : 1;
  const now = new Date();
  const base = [...refundRows, withSla(now)];

  const [[result], [totals]] = await Promise.all([
    Payment.aggregate([...base, { $match: await matchOf(query, now) }, { $facet: { rows: [{ $sort: { [field]: direction, _id: direction } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }], total: [{ $count: 'n' }] } }]),
    Payment.aggregate([...base, { $group: { _id: null, pendingPaise: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'FAILED']] }, 0, '$refunds.amountPaise'] } }, failedCount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }, breachedCount: { $sum: { $cond: ['$slaBreached', 1, 0] } } } }]),
  ]);
  const total = result.total[0]?.n ?? 0;
  return {
    data: result.rows.map(toRow),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), summary: { pendingPaise: totals?.pendingPaise ?? 0, failedCount: totals?.failedCount ?? 0, breachedCount: totals?.breachedCount ?? 0 } },
  };
}

/** Finds a refund by its list id: "<paymentId>:<key>". */
async function locateRefund(id) {
  const split = id.indexOf(':');
  const [paymentId, key] = [id.slice(0, split), id.slice(split + 1)];
  const payment = split > 0 && mongoose.isValidObjectId(paymentId) ? await Payment.findById(paymentId).lean() : null;
  const entry = payment?.refunds.find((refund) => refund.key === key);
  if (!entry) throw new NotFoundError('That refund no longer exists.');
  return { payment, entry, key };
}

/** What retrying this refund would send, so a route can compare it with the admin's refund limit first. */
export async function refundAmountPaise(id) {
  const { entry } = await locateRefund(id);
  return entry.amountPaise + (entry.walletPaise ?? 0);
}

/** Asks the gateway again for a refund it refused. A returned item goes back through its return (which also settles the seller's side). */
export async function retryRefund(id, actor) {
  const { payment, entry, key } = await locateRefund(id);
  if (entry.status !== 'FAILED') throw new ConflictError('ILLEGAL_TRANSITION', 'Only a failed refund can be retried.');

  if (key.startsWith('return:')) await settleReturn(key.slice('return:'.length));
  else {
    const updated = await refundPayment(payment._id, { key, amountPaise: entry.amountPaise + (entry.walletPaise ?? 0), reason: entry.reason ?? 'Retried by admin' });
    // a refund that never reached the gateway was never counted on the order; one the gateway took and later failed already was
    if (!entry.providerRefundId && payment.orderId) await Order.updateOne({ _id: payment.orderId }, { $inc: { refundedPaise: entry.amountPaise } });
    entry.status = updated.refunds.find((refund) => refund.key === key).status;
  }
  await recordAudit({ action: 'refund.retry', subjectType: 'refund', subjectId: id, after: { amountPaise: entry.amountPaise }, actor });
  const fresh = (await Payment.findById(payment._id).lean()).refunds.find((refund) => refund.key === key);
  return { id, status: fresh.status === 'SUCCEEDED' ? 'COMPLETED' : fresh.status === 'FAILED' ? 'FAILED' : 'PROCESSING', failureReason: fresh.failureReason ?? null };
}
