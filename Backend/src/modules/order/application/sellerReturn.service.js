import { NotFoundError } from '../../../shared/errors/AppError.js';
import { urlForKey } from '../../media/public/index.js';
import { panelStatusOf, RETURN_REASONS, RETURN_STATUS as S, SELLER_STAGES, sellerActionsOf } from '../domain/services/returnRules.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { approve, receive, recordQc, reject, schedulePickupNow } from './returnActions.service.js';

// What a seller sees and does with returns on their parcels, in the shape the seller panel reads (its status words, an
// `actions` list on the detail). Scoped by the seller id from the signed-in account, never from the request.
// Not yet: disputes. What can be done to a return lives in returnActions.service.js.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { requestedAt: 'createdAt', amountPaise: 'amountPaise', status: 'status' };
const reasonLabel = (code) => RETURN_REASONS.find((reason) => reason.code === code)?.label ?? code;

async function own(sellerId, returnId) {
  const row = await Return.findOne({ _id: returnId, sellerId: String(sellerId) });
  if (!row) throw new NotFoundError('That return is not on your account.');
  return row;
}

export const toRow = (row) => ({
  id: String(row._id),
  orderId: row.orderNumber,
  productName: row.productName,
  variantLabel: row.variantLabel,
  image: row.imageUrl,
  reason: reasonLabel(row.reasonCode),
  type: 'REFUND',
  amountPaise: row.amountPaise,
  status: panelStatusOf(row.status),
  requestedAt: row.createdAt.toISOString(),
  fulfillmentType: 'SELLER',
});

export async function listSellerReturns(sellerId, { page, pageSize, q, sort = '-requestedAt', stage }) {
  const mine = { sellerId: String(sellerId) };
  const text = q ? new RegExp(escapeRegex(q), 'i') : null;
  const filter = {
    ...mine,
    ...(stage ? { status: { $in: SELLER_STAGES[stage] } } : {}),
    ...(text ? { $or: [{ number: text }, { orderNumber: text }, { productName: text }] } : {}),
  };
  const field = SORTS[sort.replace(/^-/, '')] ?? 'createdAt';
  const [rows, total, byStatus] = await Promise.all([
    Return.find(filter).sort({ [field]: sort.startsWith('-') || !SORTS[sort] ? -1 : 1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Return.countDocuments(filter),
    Return.aggregate([{ $match: mine }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const counted = new Map(byStatus.map((entry) => [entry._id, entry.n]));
  return {
    data: rows.map(toRow),
    meta: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: Object.fromEntries(Object.entries(SELLER_STAGES).map(([name, statuses]) => [name, statuses.reduce((sum, status) => sum + (counted.get(status) ?? 0), 0)])),
    },
  };
}

/** The return as the panels read it (seller and admin share this; each adds its own bits). */
export function detailOf(row, now = new Date()) {
  const reason = RETURN_REASONS.find((entry) => entry.code === row.reasonCode);
  return {
    ...toRow(row),
    comments: row.comment,
    customerEvidence: row.evidenceKeys.map((key) => ({ id: key, url: urlForKey(key, null), fileName: key.split('/').pop(), visibility: 'PUBLIC', moderationStatus: 'APPROVED' })),
    policy: {
      decisionDueAt: row.decisionDueAt.toISOString(),
      decisionOverdue: row.status === S.REQUESTED && now > row.decisionDueAt,
      explanation: reason?.fault === 'SELLER' ? 'Counts against the seller when the customer shows the item was faulty or not as listed.' : 'A change of mind or fit: counts against the customer.',
      faultAttribution: row.faultAttribution,
      pickupDueAt: row.reverse.pickupDueAt?.toISOString() ?? null,
      qcDueAt: row.qcDueAt?.toISOString() ?? null,
      qcOverdue: row.status === S.RECEIVED && Boolean(row.qcDueAt) && now > row.qcDueAt,
    },
    timeline: row.events.map((event, index) => ({ id: `${row._id}-${index}`, returnId: String(row._id), type: panelStatusOf(event.status), actorType: event.actorType, actorName: event.actorType, reason: event.note, at: event.at.toISOString() })),
    refund: row.refund.status === 'NOT_REQUIRED' ? null : { id: row.refund.key ?? 'pending', status: { SUCCEEDED: 'COMPLETED', PROCESSING: 'PROCESSING', FAILED: 'FAILED' }[row.refund.status] ?? 'PENDING' },
    replacement: null,
    disputes: [],
    qcResult: row.qc?.result ?? null,
    qcNotes: row.qc?.notes ?? null,
    pickupAwb: row.reverse.awb,
    reverseCourierName: row.reverse.courierName,
    actions: sellerActionsOf(row.status),
  };
}

export async function getSellerReturn(sellerId, returnId) {
  return detailOf(await own(sellerId, returnId));
}

const seller = (auth) => ({ type: 'SELLER', id: auth.userId });
/** Checks the return is the seller's, does the work, and returns the refreshed detail. */
const as = async (sellerId, returnId, work) => {
  await own(sellerId, returnId);
  await work();
  return getSellerReturn(sellerId, returnId);
};

export const approveReturn = (sellerId, returnId, auth) => as(sellerId, returnId, () => approve(returnId, seller(auth)));
export const schedulePickupFor = (sellerId, returnId) => as(sellerId, returnId, () => schedulePickupNow(returnId));
export const rejectReturn = (sellerId, returnId, body, auth) => as(sellerId, returnId, () => reject(returnId, body, seller(auth)));
export const receiveReturn = (sellerId, returnId, auth) => as(sellerId, returnId, () => receive(returnId, seller(auth)));
export const recordReturnQc = (sellerId, returnId, body, auth) => as(sellerId, returnId, () => recordQc(returnId, body, seller(auth)));
