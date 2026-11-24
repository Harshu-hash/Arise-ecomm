import { NotFoundError } from '../../../shared/errors/AppError.js';
import { holdReasonOf, lineStateOf } from '../domain/settlementRules.js';
import { SettlementLine } from '../infrastructure/persistence/settlementLine.model.js';
import { SellerWallet, Withdrawal } from '../infrastructure/persistence/wallet.model.js';
import { itemsWithOpenReturn } from './settlementAccrual.service.js';

// What the admin console and the seller panel read about settlement lines (each delivered item and where its money stands).
// A line is read-only here: money moves through the wallet and withdrawals, never by editing a line.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { deliveredAt: 'deliveredAt', releaseAt: 'releaseAt', netPaise: 'netPaise', salePaise: 'salePaise' };
// the three states stored as facts; HELD is a pending line that something stands in the way of, worked out per row
const STATE_FILTERS = { PENDING: { releasedAt: null, reversedAt: null }, HELD: { releasedAt: null, reversedAt: null }, AVAILABLE: { releasedAt: { $ne: null }, reversedAt: null }, REVERSED: { reversedAt: { $ne: null } } };

const lineDto = (line, open) => {
  const returnOpen = open.has(String(line.orderItemId));
  return {
    id: String(line._id),
    orderId: line.orderNumber,
    orderItemId: String(line.orderItemId),
    sellerId: line.sellerId,
    sellerName: line.sellerName,
    productTitle: line.productTitle,
    qty: line.qty,
    customerName: line.customerName,
    paymentMethod: line.paymentMethod,
    deliveredAt: line.deliveredAt.toISOString(),
    returnWindowDays: line.returnWindowDays,
    releaseAt: line.releaseAt.toISOString(),
    releasedAt: line.releasedAt?.toISOString() ?? null,
    reversedAt: line.reversedAt?.toISOString() ?? null,
    state: lineStateOf(line, { returnOpen }),
    holdReason: holdReasonOf(line, { returnOpen }),
    codPending: Boolean(line.codPending && !line.codRemittedAt),
    salePaise: line.salePaise,
    commissionPct: line.commissionPct,
    commissionPaise: line.commissionPaise,
    closingFeePaise: line.closingFeePaise,
    collectionFeePaise: line.collectionFeePaise,
    feesBeforeTaxPaise: line.feesBeforeTaxPaise,
    gstOnFeesPaise: line.gstOnFeesPaise,
    tcsPaise: line.tcsPaise,
    tdsPaise: line.tdsPaise,
    netPaise: line.netPaise,
    negative: line.negative,
  };
};

/** Settlement lines, newest delivery first. `sellerId` fixes the seller (their panel); the admin may filter by it. */
export async function listLines({ sellerId = null, sellerIds = null, state, q, paymentMethod, page = 1, pageSize = 25, sort = '-deliveredAt' }) {
  const text = q ? new RegExp(escapeRegex(q.slice(0, 100)), 'i') : null;
  const base = {
    ...(sellerId ? { sellerId: String(sellerId) } : sellerIds ? { sellerId: { $in: sellerIds } } : {}),
    ...(paymentMethod ? { paymentMethod: String(paymentMethod).toUpperCase() } : {}),
    ...(text ? { $or: [{ orderNumber: text }, { productTitle: text }, { customerName: text }, { sellerName: text }] } : {}),
  };
  const filter = { ...base, ...(STATE_FILTERS[state] ?? {}) };
  const field = SORTS[sort.replace(/^-/, '')] ?? 'deliveredAt';
  const direction = sort.startsWith('-') || !sort ? -1 : 1;
  const [rows, total, byState] = await Promise.all([
    SettlementLine.find(filter).sort({ [field]: direction, _id: direction }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    SettlementLine.countDocuments(filter),
    SettlementLine.aggregate([{ $match: base }, { $group: { _id: { r: { $cond: [{ $ne: ['$reversedAt', null] }, 'REVERSED', { $cond: [{ $ne: ['$releasedAt', null] }, 'AVAILABLE', 'PENDING'] }] } }, n: { $sum: 1 } } }]),
  ]);
  const open = await itemsWithOpenReturn(rows.map((row) => row.orderItemId));
  const data = rows.map((row) => lineDto(row, open)).filter((row) => state !== 'HELD' || row.state === 'HELD'); // shortcut: HELD filters the page, not the whole set
  return { data, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { state: Object.fromEntries(byState.map((entry) => [entry._id.r, entry.n])) } } };
}

export async function getLine(id, { sellerId = null, sellerIds = null } = {}) {
  const line = await SettlementLine.findOne({ _id: id, ...(sellerId ? { sellerId: String(sellerId) } : sellerIds ? { sellerId: { $in: sellerIds } } : {}) }).lean();
  if (!line) throw new NotFoundError('That settlement line does not exist.');
  return lineDto(line, await itemsWithOpenReturn([line.orderItemId]));
}

/** The admin's finance tiles: what Arise owes sellers, and the withdrawals waiting on someone. */
export async function platformSummary({ sellerIds = null } = {}) {
  const scoped = sellerIds ? [{ $match: { sellerId: { $in: sellerIds } } }] : [];
  const [wallets, open] = await Promise.all([
    SellerWallet.aggregate([...scoped, { $group: { _id: null, pending: { $sum: '$pendingPaise' }, available: { $sum: '$availablePaise' }, locked: { $sum: '$lockedPaise' }, withdrawn: { $sum: '$lifetimeWithdrawnPaise' }, negative: { $sum: { $cond: [{ $lt: ['$availablePaise', 0] }, 1, 0] } } } }]),
    Withdrawal.aggregate([...scoped, { $match: { status: { $in: ['REQUESTED', 'APPROVED'] } } }, { $group: { _id: '$status', n: { $sum: 1 }, paise: { $sum: '$amountPaise' } } }]),
  ]);
  const by = (status) => open.find((row) => row._id === status) ?? { n: 0, paise: 0 };
  const w = wallets[0] ?? {};
  return {
    owedToSellersPaise: (w.pending ?? 0) + (w.available ?? 0) + (w.locked ?? 0),
    pendingPaise: w.pending ?? 0,
    availablePaise: w.available ?? 0,
    lockedPaise: w.locked ?? 0,
    withdrawnPaise: w.withdrawn ?? 0,
    sellersOwingPaise: w.negative ?? 0,
    requestedCount: by('REQUESTED').n,
    requestedPaise: by('REQUESTED').paise,
    approvedCount: by('APPROVED').n,
    approvedPaise: by('APPROVED').paise,
  };
}
