import { withTransaction } from '../../../config/database.js';
import { logger } from '../../../config/logger.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { assertMakerChecker } from '../../../shared/policies/ownership.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getSellerPayoutProfiles } from '../../identity/public/index.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { WITHDRAWAL, WITHDRAWAL_OPEN, withdrawableOf, withdrawalProblem } from '../domain/settlementRules.js';
import { SellerWallet, SettlementCounter, Withdrawal } from '../infrastructure/persistence/wallet.model.js';
import { accountBlock, post, reservePctFor, startOfIstDay } from './wallet.service.js';

// A seller's withdrawal: they ask, an admin approves each request by hand, then pays it by bank transfer and records the
// transaction number. The money is locked from the moment of the request until it is paid (or given back on a rejection), so it
// can never be spent twice. Every state change is one conditional update: a double click or two admins at once changes it once.

const failure = (status, code, message) => new AppError({ code, message, status });
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const eventOf = (status, actorType, actorId, note = null) => ({ status, at: new Date(), actorType, actorId: actorId ? String(actorId) : null, note });

export const toWithdrawalDto = (row, { admin = false } = {}) => ({
  id: String(row._id),
  number: row.number,
  sellerId: row.sellerId,
  sellerName: row.sellerName,
  amountPaise: row.amountPaise,
  status: row.status,
  bank: { holder: row.bank?.holder ?? null, maskedAccount: row.bank?.last4 ? `••${row.bank.last4}` : null, ifsc: row.bank?.ifsc ?? null, bankName: row.bank?.bankName ?? null },
  requestedAt: row.createdAt.toISOString(),
  approvedAt: row.approvedAt?.toISOString() ?? null,
  paidAt: row.paidAt?.toISOString() ?? null,
  txnNo: row.txnNo,
  utr: row.utr,
  decisionReason: row.decisionReason,
  timeline: row.events.map((event) => ({ status: event.status, at: event.at.toISOString(), note: event.note })),
  ...(admin ? { allowedActions: { [WITHDRAWAL.REQUESTED]: ['APPROVE', 'REJECT'], [WITHDRAWAL.APPROVED]: ['PAY', 'REJECT'] }[row.status] ?? [] } : {}),
});

const tell = (sellerId, key, title, body, severity = 'info') => notify({ to: { type: 'SELLER', id: sellerId }, category: CATEGORY.ACCOUNT, key, title, body, severity, link: '/payments/wallet' })
  .catch((err) => logger.warn({ err }, 'Could not notify the seller about a withdrawal'));

async function numberFor(session) {
  const now = new Date();
  const month = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { seq } = await SettlementCounter.findOneAndUpdate({ _id: `WD:${month}` }, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
  return `WD-${month}-${String(seq).padStart(4, '0')}`;
}

/** The seller asks to withdraw `amountPaise`: checked against their account, the admin's limits and their balance, then locked. */
export async function requestWithdrawal(sellerId, { amountPaise }, auth) {
  const [profiles, limits] = await Promise.all([getSellerPayoutProfiles([sellerId]), getSettingsSection('settlement')]);
  const profile = profiles.get(String(sellerId));
  const blocked = accountBlock(profile);
  if (blocked) throw failure(409, blocked[0], blocked[1]);
  const reservePct = await reservePctFor(profile);

  const created = await withTransaction(async (session) => {
    // The balance update below makes concurrent requests conflict, so the counts read here cannot be raced past the limits.
    const wallet = await SellerWallet.findById(String(sellerId)).session(session).lean();
    const { reservePaise, withdrawablePaise } = withdrawableOf(wallet?.availablePaise ?? 0, reservePct);
    const [open, today] = await Promise.all([
      Withdrawal.countDocuments({ sellerId: String(sellerId), status: { $in: WITHDRAWAL_OPEN } }).session(session),
      Withdrawal.aggregate([{ $match: { sellerId: String(sellerId), status: { $in: [...WITHDRAWAL_OPEN, WITHDRAWAL.PAID] }, createdAt: { $gte: startOfIstDay() } } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }]).session(session),
    ]);
    const problem = withdrawalProblem({ amountPaise, withdrawablePaise, limits, requestedTodayPaise: today[0]?.paise ?? 0, openCount: open });
    if (problem) throw failure(409, problem[0], problem[1]);

    const withdrawal = new Withdrawal({
      number: await numberFor(session),
      sellerId: String(sellerId),
      sellerName: profile.name,
      amountPaise,
      bank: { holder: profile.bank.holder, last4: profile.bankLast4, ifsc: profile.bank.ifsc, bankName: profile.bank.bankName },
      requestedById: auth.userId,
      events: [eventOf(WITHDRAWAL.REQUESTED, 'SELLER', auth.userId)],
    });
    await withdrawal.save({ session });
    await post(session, { sellerId, event: `WDL:${withdrawal._id}`, type: 'WITHDRAWAL_LOCK', moves: [{ bucket: 'available', deltaPaise: -amountPaise }, { bucket: 'locked', deltaPaise: amountPaise }], refType: 'WITHDRAWAL', refId: withdrawal._id, note: withdrawal.number, actorId: auth.userId, requireAvailable: amountPaise + reservePaise });
    return withdrawal;
  });
  await recordAudit({ action: 'finance.withdrawal.request', subjectType: 'withdrawal', subjectId: created._id, after: { amountPaise }, actor: auth });
  return toWithdrawalDto(created);
}

/** Puts a requested amount back into the available balance (rejection or cancellation). */
const unlock = (session, withdrawal, actorId) => post(session, { sellerId: withdrawal.sellerId, event: `WDU:${withdrawal._id}`, type: 'WITHDRAWAL_UNLOCK', moves: [{ bucket: 'locked', deltaPaise: -withdrawal.amountPaise }, { bucket: 'available', deltaPaise: withdrawal.amountPaise }], refType: 'WITHDRAWAL', refId: withdrawal._id, note: withdrawal.number, actorId });

/** Moves a withdrawal out of one of `from` into `to` with `set`, in one transaction with `after` (the ledger side). Null when it was not in a status that allows it. */
async function transition(id, { from, to, set = {}, actor, note = null, after }) {
  return withTransaction(async (session) => {
    const moved = await Withdrawal.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { status: to, ...set }, $push: { events: eventOf(to, actor.type, actor.id, note) } },
      { new: true, session },
    );
    if (!moved) return null;
    if (after) await after(session, moved);
    return moved;
  });
}

const notOpen = (row) => failure(409, 'WITHDRAWAL_NOT_ACTIONABLE', `This withdrawal is already ${row ? row.status.toLowerCase() : 'closed'}.`);

/** The seller withdraws their own request while no admin has approved it. */
export async function cancelWithdrawal(sellerId, id, auth) {
  const own = await Withdrawal.findOne({ _id: id, sellerId: String(sellerId) });
  if (!own) throw new NotFoundError('That withdrawal is not on your account.');
  const done = await transition(id, { from: [WITHDRAWAL.REQUESTED], to: WITHDRAWAL.CANCELLED, actor: { type: 'SELLER', id: auth.userId }, after: (session, row) => unlock(session, row, auth.userId) });
  if (!done) throw notOpen(own);
  return toWithdrawalDto(done);
}

const find = async (id) => {
  const row = await Withdrawal.findById(id);
  if (!row) throw new NotFoundError('That withdrawal does not exist.');
  return row;
};

async function assertSellerNotOnHold(sellerId) {
  const profile = (await getSellerPayoutProfiles([sellerId])).get(String(sellerId));
  if (profile?.onHold) throw failure(409, 'PAYOUT_ON_HOLD', 'Payouts are on hold for this seller. Release the hold first.');
  if (!profile?.bankOk) throw failure(409, 'BANK_NOT_VERIFIED', 'This seller\'s bank account is not verified.');
}

export async function approveWithdrawal(id, auth) {
  const row = await find(id);
  await assertSellerNotOnHold(row.sellerId);
  const done = await transition(id, { from: [WITHDRAWAL.REQUESTED], to: WITHDRAWAL.APPROVED, set: { approvedById: auth.userId, approvedAt: new Date() }, actor: { type: 'ADMIN', id: auth.userId } });
  if (!done) throw notOpen(row);
  await recordAudit({ action: 'finance.withdrawal.approve', subjectType: 'withdrawal', subjectId: id, after: { amountPaise: done.amountPaise }, actor: auth });
  tell(done.sellerId, `wd-approved:${id}`, 'Withdrawal approved', `Your withdrawal ${done.number} of ${rupees(done.amountPaise)} was approved and will be transferred to your bank account.`);
  return toWithdrawalDto(done, { admin: true });
}

export async function rejectWithdrawal(id, { reason }, auth) {
  const row = await find(id);
  const done = await transition(id, { from: WITHDRAWAL_OPEN, to: WITHDRAWAL.REJECTED, set: { decisionReason: reason }, actor: { type: 'ADMIN', id: auth.userId }, note: reason, after: (session, moved) => unlock(session, moved, auth.userId) });
  if (!done) throw notOpen(row);
  await recordAudit({ action: 'finance.withdrawal.reject', subjectType: 'withdrawal', subjectId: id, reason, actor: auth });
  tell(done.sellerId, `wd-rejected:${id}`, 'Withdrawal rejected', `Your withdrawal ${done.number} of ${rupees(done.amountPaise)} was rejected: ${reason}. The amount is back in your available balance.`, 'warning');
  return toWithdrawalDto(done, { admin: true });
}

/** The admin has sent the money by bank transfer and records its transaction number; the locked amount leaves the wallet. */
export async function payWithdrawal(id, { txnNo, utr = '' }, auth) {
  const [row, { payoutAdjustThresholdPaise }] = await Promise.all([find(id), getSettingsSection('approvalThresholds')]);
  // a large payout needs two different people: the one who approved it may not also pay it
  if (row.amountPaise > payoutAdjustThresholdPaise && row.approvedById) assertMakerChecker(row.approvedById, auth.userId);
  await assertSellerNotOnHold(row.sellerId);
  const done = await transition(id, {
    from: [WITHDRAWAL.APPROVED], to: WITHDRAWAL.PAID, set: { paidById: auth.userId, paidAt: new Date(), txnNo, utr }, actor: { type: 'ADMIN', id: auth.userId }, note: txnNo,
    after: (session, moved) => post(session, { sellerId: moved.sellerId, event: `WDP:${moved._id}`, type: 'WITHDRAWAL_PAID', moves: [{ bucket: 'locked', deltaPaise: -moved.amountPaise }], refType: 'WITHDRAWAL', refId: moved._id, note: `${moved.number} ${txnNo}`, actorId: auth.userId, lifetime: { withdrawn: moved.amountPaise } }),
  });
  if (!done) throw notOpen(row);
  await recordAudit({ action: 'finance.withdrawal.pay', subjectType: 'withdrawal', subjectId: id, after: { amountPaise: done.amountPaise, txnNo }, actor: auth });
  tell(done.sellerId, `wd-paid:${id}`, 'Withdrawal paid', `${rupees(done.amountPaise)} was transferred to your bank account (transaction ${txnNo}).`);
  return toWithdrawalDto(done, { admin: true });
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Withdrawals, newest first; for one seller (their panel) or all (the admin queue). */
export async function listWithdrawals({ sellerId = null, sellerIds = null, status, q, page = 1, pageSize = 25 }, { admin = false } = {}) {
  const base = { ...(sellerId ? { sellerId: String(sellerId) } : sellerIds ? { sellerId: { $in: sellerIds } } : {}), ...(q ? { $or: [{ number: new RegExp(escapeRegex(q.slice(0, 60)), 'i') }, { sellerName: new RegExp(escapeRegex(q.slice(0, 60)), 'i') }] } : {}) };
  const wanted = status ? String(status).split(',').filter(Boolean) : [];
  const filter = { ...base, ...(wanted.length ? { status: { $in: wanted } } : {}) };
  const [rows, total, byStatus] = await Promise.all([
    Withdrawal.find(filter).sort({ _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Withdrawal.countDocuments(filter),
    Withdrawal.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  return { data: rows.map((row) => toWithdrawalDto(row, { admin })), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), facets: { status: Object.fromEntries(byStatus.map((entry) => [entry._id, entry.n])) } } };
}

export async function getWithdrawal(id, { sellerId = null, sellerIds = null, admin = false } = {}) {
  const row = await Withdrawal.findOne({ _id: id, ...(sellerId ? { sellerId: String(sellerId) } : sellerIds ? { sellerId: { $in: sellerIds } } : {}) });
  if (!row) throw new NotFoundError('That withdrawal does not exist.');
  return toWithdrawalDto(row, { admin });
}
