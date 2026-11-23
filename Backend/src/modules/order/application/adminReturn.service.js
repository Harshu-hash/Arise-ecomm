import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getDefaultAddress } from '../../customer/public/index.js';
import { deliveredAtOf, returnWindowEndsAt } from '../domain/services/orderStatus.js';
import { ADMIN_CANCELLABLE, panelStatusOf, RETURN_REASONS, RETURN_STATUS as S, sellerActionsOf } from '../domain/services/returnRules.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { Return } from '../infrastructure/persistence/return.model.js';
import { retryCancelPickup } from './returnPickup.service.js';
import { settleReturn } from './returnSettlement.service.js';
import { approve, cancelReturnAsAdmin, overrideRejection, receive, recordQc, reject, schedulePickupNow } from './returnActions.service.js';
import { createReturn } from './return.service.js';
import { detailOf, toRow } from './sellerReturn.service.js';

// The admin console's returns: every return across all sellers, in the shape its Returns pages read (the seller panel's status
// words), and the actions an admin may take. What can be done to a return lives in returnActions.service.js; each action here
// needs its own permission and is audited. Refund only: "convert to refund" has nothing to convert.

/** Which button each action is, and the permission it needs. */
const BUTTONS = {
  approve: ['APPROVE', 'orders.return.approve'],
  reject: ['REJECT', 'orders.return.reject'],
  'schedule-pickup': ['SCHEDULE_PICKUP', 'orders.return.reschedule'],
  receive: ['MARK_RECEIVED', 'orders.return.mark_received'],
  qc: ['RECORD_QC', 'orders.return.qc'],
};
export const RETURN_PERMISSIONS = ['orders.return.approve', 'orders.return.reject', 'orders.return.reschedule', 'orders.return.mark_received', 'orders.return.qc'];

const QC_CHECKLIST = ['All original packaging present', 'Accessories and freebies included', 'No signs of use or damage', 'Serial number matches the dispatched unit', 'Tags and labels intact'];
const REFUND = { SUCCEEDED: 'COMPLETED', PROCESSING: 'PROCESSING', FAILED: 'FAILED' };
const SORTS = { requestedAt: 'createdAt', amountPaise: 'amountPaise', status: 'status', customerName: 'customerName' };
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csv = (value) => (value ? String(value).split(',').filter(Boolean) : []);

const adminRow = (row, now = Date.now()) => ({
  ...toRow(row),
  customerName: row.customerName,
  sellerId: row.sellerId,
  sellerName: row.sellerName,
  faultAttribution: row.faultAttribution,
  ageDays: Math.floor((now - row.createdAt.getTime()) / 86_400_000),
  qcResult: row.qc?.result ?? null,
  pickupCancelFailed: Boolean(row.reverse.cancelError) && !row.reverse.cancelledAt, // a cancelled return whose courier booking is still live
  refundStatus: row.refund.status === 'NOT_REQUIRED' ? null : REFUND[row.refund.status] ?? 'INITIATED',
});
export { adminRow as toAdminReturnRow };

export async function listAdminReturns(query) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 25)));
  const sort = query.sort || 'requestedAt';
  const wanted = csv(query.status);
  const statuses = Object.values(S).filter((status) => wanted.includes(panelStatusOf(status)) || wanted.includes(status));
  const text = query.q ? new RegExp(escapeRegex(String(query.q).slice(0, 100)), 'i') : null;
  const reason = RETURN_REASONS.find((entry) => entry.code === query.reason || entry.label === query.reason)?.code;
  const base = {
    ...(query.type === 'REPLACEMENT' ? { _id: null } : {}), // refund only: there are no replacements
    ...(query.sellerId ? { sellerId: String(query.sellerId) } : {}),
    ...(query.faultAttribution ? { faultAttribution: String(query.faultAttribution) } : {}),
    ...(query.reason ? { reasonCode: reason ?? '-' } : {}),
    ...(query.needsAttention === 'true' ? { 'reverse.cancelError': { $ne: null }, 'reverse.cancelledAt': null } : {}),
    ...(query.qcResult ? { 'qc.result': String(query.qcResult) } : {}),
    ...(query['requestedAt[gte]'] || query['requestedAt[lte]'] ? { createdAt: { ...(query['requestedAt[gte]'] ? { $gte: new Date(query['requestedAt[gte]']) } : {}), ...(query['requestedAt[lte]'] ? { $lte: new Date(query['requestedAt[lte]']) } : {}) } } : {}),
    ...(text ? { $or: [{ number: text }, { orderNumber: text }, { productName: text }, { customerName: text }, { sellerName: text }] } : {}),
  };
  const filter = { ...base, ...(statuses.length ? { status: { $in: statuses } } : {}) };
  const field = SORTS[sort.replace(/^-/, '')] ?? 'createdAt';
  // an older return is the larger "age", so sorting by age is sorting by request time the other way round
  const direction = (sort.replace(/^-/, '') === 'ageDays' ? !sort.startsWith('-') : sort.startsWith('-')) ? -1 : 1;
  const now = Date.now();
  const [rows, total, byStatus] = await Promise.all([
    Return.find(filter).sort({ [field]: direction, _id: direction }).skip((page - 1) * pageSize).limit(pageSize),
    Return.countDocuments(filter),
    Return.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const facet = {};
  for (const { _id, n } of byStatus) facet[panelStatusOf(_id)] = (facet[panelStatusOf(_id)] ?? 0) + n;
  return {
    data: rows.map((row) => adminRow(row, now)),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { status: facet, type: { REFUND: byStatus.reduce((sum, entry) => sum + entry.n, 0) } } },
  };
}

/** One return with what the detail page shows. `granted`: the return permissions this admin holds. */
export async function getAdminReturn(returnId, granted = []) {
  const row = await Return.findById(returnId);
  if (!row) throw new NotFoundError('That return no longer exists.');
  const order = await Order.findById(row.orderId);
  const sub = order?.subOrders.id(row.subOrderId);
  const item = sub?.items.id(row.itemId);
  const allowed = sellerActionsOf(row.status).map((action) => BUTTONS[action]).filter(([, permission]) => granted.includes(permission)).map(([button]) => button);
  if (row.status === S.REJECTED && granted.includes('orders.return.approve')) allowed.push('OVERRIDE_REJECTION');
  if (row.status === S.QC_PASSED && row.refund.status === 'FAILED' && granted.includes('orders.return.qc')) allowed.push('RETRY_REFUND');
  if (ADMIN_CANCELLABLE.includes(row.status) && granted.includes('orders.return.reject')) allowed.push('CANCEL_RETURN');
  const detail = detailOf(row);
  return {
    data: {
      ...adminRow(row),
      ...detail,
      refundId: row.refund.key,
      overrideReason: row.decision?.overrideReason ?? null,
      itemStatus: sub?.status ?? null,
    },
    meta: {
      allowedActions: allowed,
      item: item ? { deliveredAt: deliveredAtOf(sub)?.toISOString() ?? null, returnWindowEndsAt: returnWindowEndsAt(sub, item)?.toISOString() ?? null } : null,
      order: { paymentMethod: order?.paymentMethod ?? null },
      refund: detail.refund && { ...detail.refund, amountPaise: row.amountPaise, failureReason: row.refund.failureReason },
      qcChecklist: QC_CHECKLIST,
      pickupCancelError: row.reverse.cancelledAt ? null : row.reverse.cancelError, // shown by the console once it has a place for it; `cancel-pickup` retries
    },
  };
}

/* ------------------------------------------------------------------------------------------------- actions */

const adminActor = (auth) => ({ type: 'ADMIN', id: auth.userId });
const audit = (action, returnId, reason, auth) => recordAudit({ action: `orders.return.${action}`, subjectType: 'return', subjectId: returnId, reason: reason ?? null, actor: { userId: auth.userId, role: auth.role } });

/** Does one action to a return, audits it, and returns the refreshed detail. `granted` is for the buttons on it. */
export async function actOnReturn(returnId, action, body, auth, granted) {
  const actor = adminActor(auth);
  if (!await Return.exists({ _id: returnId })) throw new NotFoundError('That return no longer exists.');
  if (action === 'approve') await approve(returnId, actor);
  else if (action === 'reject') await reject(returnId, body, actor);
  else if (action === 'schedule-pickup') await schedulePickupNow(returnId);
  else if (action === 'mark-received') await receive(returnId, actor);
  else if (action === 'qc') await recordQc(returnId, body, actor);
  else if (action === 'cancel-pickup') await retryCancelPickup(returnId);
  else if (action === 'retry-refund') await settleReturn(returnId);
  else if (action === 'cancel') await cancelReturnAsAdmin(returnId, body.reason, actor);
  else await overrideRejection(returnId, body.reason, actor);
  await audit(action.replaceAll('-', '_'), returnId, body.reason ?? body.notes, auth);
  return getAdminReturn(returnId, granted);
}

/** An admin raises a return on the customer's behalf (same eligibility; no photo needed). It is picked up from the customer's default address. */
export async function raiseReturn(reference, itemId, { reason, comments }, auth, granted) {
  const order = await Order.findOne(/^[a-f\d]{24}$/i.test(reference) ? { _id: reference } : { number: reference }, '_id customerId');
  if (!order) throw new NotFoundError('That order no longer exists.');
  const code = RETURN_REASONS.find((entry) => entry.code === reason || entry.label === reason)?.code;
  if (!code) throw new AppError({ code: 'RETURN_REASON_REQUIRED', status: 422, message: 'Choose a return reason.' });
  const address = await getDefaultAddress(order.customerId);
  if (!address) throw new AppError({ code: 'PICKUP_ADDRESS_NOT_FOUND', status: 409, message: 'The customer has no saved address to collect the item from.' });
  const created = await createReturn(order.customerId, { orderId: order._id, orderItemId: itemId, resolution: 'REFUND', reasonCode: code, pickupAddressId: address.id, comment: comments ?? null }, new Date(), { adminId: auth.userId });
  await audit('initiate', created.id, reason, auth);
  return getAdminReturn(created.id, granted);
}
