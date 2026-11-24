import mongoose from 'mongoose';
import { Payment } from '../../payment/public/index.js';
import { Order } from '../infrastructure/persistence/order.model.js';

// The admin Payments page: every payment attempt with its order and customer, plus headline sums. It lives with orders because it
// joins them (order number, customer name, and whether a cash-on-delivery parcel has been delivered, which is when the cash is collected).

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csv = (value) => (value ? String(value).split(',').filter(Boolean) : []);
const METHOD_LABEL = { upi: 'UPI', card: 'CARD', cod: 'COD' };
const GATEWAY_LABEL = { RAZORPAY: 'Razorpay', COD: 'CASH' };
const GATEWAY_CODE = { Razorpay: 'RAZORPAY', CASH: 'COD' };
const TAB_STATUSES = { CAPTURED: ['CAPTURED'], PENDING: ['PENDING'], FAILED: ['FAILED'], CANCELLED: ['CANCELLED'] };
const SORTS = { createdAt: 'createdAt', amountPaise: 'amountPaise', status: 'displayStatus' };

const liveParcels = { $filter: { input: { $ifNull: ['$order.subOrders', []] }, cond: { $not: [{ $in: ['$$this.status', ['CANCELLED', 'RTO_DELIVERED']] }] } } };
// Cash is collected once every live parcel of the order has been delivered.
const cashCollected = {
  $and: [
    { $gt: [{ $size: liveParcels }, 0] },
    { $eq: [{ $size: { $filter: { input: liveParcels, cond: { $eq: [{ $ifNull: ['$$this.deliveredAt', null] }, null] } } } }, 0] },
  ],
};

const withOrder = [
  { $lookup: { from: Order.collection.name, localField: 'orderId', foreignField: '_id', as: 'order' } },
  { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      displayStatus: {
        $switch: {
          branches: [
            { case: { $eq: ['$status', 'SUCCEEDED'] }, then: 'CAPTURED' },
            { case: { $eq: ['$status', 'COD_PENDING'] }, then: { $cond: [cashCollected, 'CAPTURED', 'PENDING'] } },
            { case: { $eq: ['$status', 'REQUIRES_ACTION'] }, then: 'PENDING' },
            { case: { $eq: ['$status', 'CANCELLED'] }, then: 'CANCELLED' },
          ],
          default: 'FAILED',
        },
      },
    },
  },
];

async function paymentFilter(query) {
  const methods = csv(query.method).map((method) => method.toLowerCase()).filter((method) => METHOD_LABEL[method]);
  const providers = csv(query.gateway).map((gateway) => GATEWAY_CODE[gateway]).filter(Boolean);
  const from = query['createdAt[gte]'];
  const to = query['createdAt[lte]'];
  const min = Number(query['amountPaise[gte]']);
  const max = Number(query['amountPaise[lte]']);
  const filter = {
    ...(methods.length ? { method: { $in: methods } } : {}),
    ...(csv(query.gateway).length ? { provider: { $in: providers.length ? providers : ['none'] } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
    ...(Number.isFinite(min) || Number.isFinite(max) ? { amountPaise: { ...(Number.isFinite(min) ? { $gte: min } : {}), ...(Number.isFinite(max) ? { $lte: max } : {}) } } : {}),
  };
  if (query.q) {
    const search = new RegExp(escapeRegex(query.q), 'i');
    const orders = await Order.find({ number: search }, '_id').limit(50).lean();
    filter.$or = [
      ...(mongoose.isValidObjectId(query.q) ? [{ _id: new mongoose.Types.ObjectId(query.q) }] : []),
      { providerOrderId: search },
      { providerPaymentId: search },
      ...(orders.length ? [{ orderId: { $in: orders.map((order) => order._id) } }] : []),
    ];
  }
  return filter;
}

const refundedOf = (payment) => (payment.refunds ?? []).filter((refund) => refund.status === 'SUCCEEDED').reduce((total, refund) => total + refund.amountPaise, 0);

const toRow = (payment) => {
  const refundedPaise = refundedOf(payment);
  return {
    id: String(payment._id),
    orderId: payment.order?.number ?? null,
    customerId: payment.customerId,
    customerName: payment.order?.address?.name ?? '—',
    amountPaise: payment.amountPaise,
    refundedPaise,
    settledPaise: payment.displayStatus === 'CAPTURED' ? payment.amountPaise - refundedPaise : 0,
    method: METHOD_LABEL[payment.method] ?? payment.method,
    gateway: GATEWAY_LABEL[payment.provider] ?? payment.provider,
    status: payment.displayStatus,
    failureReason: payment.failureReason ?? null,
    txnRef: payment.providerPaymentId ?? payment.providerOrderId,
    createdAt: payment.createdAt.toISOString(),
  };
};

/** Headline sums over every payment: captured money, cash on delivery not yet collected, failed attempts. */
async function summary() {
  const [online, failed, cod] = await Promise.all([
    Payment.aggregate([{ $match: { status: 'SUCCEEDED' } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }]),
    Payment.countDocuments({ status: 'FAILED' }),
    Payment.aggregate([{ $match: { status: 'COD_PENDING' } }, ...withOrder, { $group: { _id: '$displayStatus', paise: { $sum: '$amountPaise' } } }]),
  ]);
  const cash = Object.fromEntries(cod.map((row) => [row._id, row.paise]));
  return { capturedPaise: (online[0]?.paise ?? 0) + (cash.CAPTURED ?? 0), pendingCodPaise: cash.PENDING ?? 0, failedCount: failed };
}

export async function listAdminPayments(query) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 25)));
  const sort = query.sort || '-createdAt';
  const field = SORTS[sort.replace(/^-/, '')] ?? 'createdAt';
  const direction = sort.startsWith('-') || !SORTS[sort] ? -1 : 1;
  const statuses = TAB_STATUSES[query.status] ?? null;

  const [[result], totals] = await Promise.all([
    Payment.aggregate([
      { $match: await paymentFilter(query) },
      ...withOrder,
      ...(statuses ? [{ $match: { displayStatus: { $in: statuses } } }] : []),
      { $facet: { rows: [{ $sort: { [field]: direction, _id: direction } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }], total: [{ $count: 'n' }] } },
    ]),
    summary(),
  ]);
  const total = result.total[0]?.n ?? 0;
  return {
    data: result.rows.map(toRow),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), summary: totals },
  };
}
