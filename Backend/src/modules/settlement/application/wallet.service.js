import { withTransaction } from '../../../config/database.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getSellerPayoutProfiles, setSellerPayoutHold } from '../../identity/public/index.js';
import { BUCKETS, withdrawableOf } from '../domain/settlementRules.js';
import { SellerWallet, WalletEntry, Withdrawal } from '../infrastructure/persistence/wallet.model.js';

// The seller wallet: every balance change goes through `post`, which writes the ledger rows and moves the balances in the same
// transaction, so a balance that its own ledger cannot explain is impossible (and verifyWallet proves it).

const DUPLICATE_KEY = 11000;
const failure = (status, code, message) => new AppError({ code, message, status });

/**
 * Posts one wallet event inside the caller's transaction. `moves`: [{ bucket, deltaPaise }] (signed). `event` names the event
 * (e.g. `EARN:<lineId>`): posting it twice does nothing and returns false. `requireAvailable`: only post if the available balance
 * holds at least that much (the check and the change are one atomic update, which is what stops a double spend); it throws
 * INSUFFICIENT_BALANCE otherwise. `lifetime`: { earned, withdrawn } signed amounts for the wallet's running totals.
 */
export async function post(session, { sellerId, event, type, moves, refType = null, refId = null, orderNumber = null, note = null, actorId = null, requireAvailable = null, lifetime = {} }) {
  if (await WalletEntry.exists({ key: `${event}:${moves[0].bucket}` }).session(session)) return false;
  const inc = Object.fromEntries(moves.map((move) => [`${move.bucket}Paise`, move.deltaPaise]));
  if (lifetime.earned) inc.lifetimeEarnedPaise = lifetime.earned;
  if (lifetime.withdrawn) inc.lifetimeWithdrawnPaise = lifetime.withdrawn;
  const wallet = await SellerWallet.findOneAndUpdate(
    { _id: String(sellerId), ...(requireAvailable != null ? { availablePaise: { $gte: requireAvailable } } : {}) },
    { $inc: inc },
    { new: true, upsert: requireAvailable == null, session },
  );
  if (!wallet) throw failure(409, 'INSUFFICIENT_BALANCE', 'That is more than your withdrawable balance.');
  await WalletEntry.create(moves.map((move) => ({ key: `${event}:${move.bucket}`, sellerId: String(sellerId), type, bucket: move.bucket, deltaPaise: move.deltaPaise, refType, refId: refId && String(refId), orderNumber, note, actorId })), { session, ordered: true });
  return true;
}

/** Runs `post` in its own transaction; true when it posted, false when this event was already posted (a repeat or a race). */
export async function postOnce(args) {
  try {
    return await withTransaction((session) => post(session, args));
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) return false;
    throw error;
  }
}

export const walletOf = (sellerId) => SellerWallet.findById(String(sellerId)).lean();

const startOfIstDay = (now = new Date()) => {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000);
};
export { startOfIstDay };

/** The reserve a new seller keeps, as a percentage (0 for an established seller). */
export async function reservePctFor(profile, now = new Date()) {
  const [{ newSellerDays }, { reserveHoldPctNewSellers }] = await Promise.all([getSettingsSection('settlement'), getSettingsSection('sellerPolicies')]);
  const isNew = profile?.approvedAt && now.getTime() - new Date(profile.approvedAt).getTime() < newSellerDays * 86_400_000;
  return isNew ? reserveHoldPctNewSellers : 0;
}

/** Why this seller cannot withdraw right now (null when they can), from their account rather than their balance. */
export const accountBlock = (profile) => {
  if (!profile) return ['SELLER_NOT_FOUND', 'This seller account does not exist.'];
  if (profile.onHold) return ['PAYOUT_ON_HOLD', profile.holdReason ? `Withdrawals are on hold: ${profile.holdReason}` : 'Withdrawals are on hold for your account. Contact support.'];
  if (!profile.bankOk) return ['BANK_NOT_VERIFIED', 'Your bank account is not verified yet.'];
  if (!profile.hasPan) return ['PAN_REQUIRED', 'Add your PAN in your profile before withdrawing.'];
  return null;
};

/** The seller's wallet as their panel (and the admin's seller view) shows it. */
export async function walletView(sellerId) {
  const [wallet, profiles, limits, open] = await Promise.all([
    walletOf(sellerId),
    getSellerPayoutProfiles([sellerId]),
    getSettingsSection('settlement'),
    Withdrawal.aggregate([{ $match: { sellerId: String(sellerId), status: { $in: ['REQUESTED', 'APPROVED'] } } }, { $group: { _id: null, n: { $sum: 1 }, paise: { $sum: '$amountPaise' } } }]),
  ]);
  const profile = profiles.get(String(sellerId));
  const balances = { pendingPaise: wallet?.pendingPaise ?? 0, availablePaise: wallet?.availablePaise ?? 0, lockedPaise: wallet?.lockedPaise ?? 0 };
  const { reservePaise, withdrawablePaise } = withdrawableOf(balances.availablePaise, await reservePctFor(profile));
  const block = accountBlock(profile);
  return {
    sellerId: String(sellerId),
    ...balances,
    reservePaise,
    withdrawablePaise,
    lifetimeEarnedPaise: wallet?.lifetimeEarnedPaise ?? 0,
    lifetimeWithdrawnPaise: wallet?.lifetimeWithdrawnPaise ?? 0,
    openWithdrawals: open[0]?.n ?? 0,
    openWithdrawalPaise: open[0]?.paise ?? 0,
    canWithdraw: !block && withdrawablePaise >= limits.minWithdrawalPaise && (open[0]?.n ?? 0) < limits.maxOpenWithdrawals,
    blockedReason: block?.[1] ?? null,
    bank: { verified: Boolean(profile?.bankOk), last4: profile?.bankLast4 ?? null },
    limits: { minWithdrawalPaise: limits.minWithdrawalPaise, maxWithdrawalPaise: limits.maxWithdrawalPaise, dailyWithdrawalLimitPaise: limits.dailyWithdrawalLimitPaise, maxOpenWithdrawals: limits.maxOpenWithdrawals },
  };
}

const entryDto = (entry) => ({ id: String(entry._id), type: entry.type, bucket: entry.bucket, deltaPaise: entry.deltaPaise, orderNumber: entry.orderNumber, note: entry.note, createdAt: entry.createdAt.toISOString() });

/** The wallet's ledger, newest first. */
export async function listLedger(sellerId, { page = 1, pageSize = 25, type } = {}) {
  const filter = { sellerId: String(sellerId), ...(type ? { type } : {}) };
  const [rows, total] = await Promise.all([
    WalletEntry.find(filter).sort({ _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    WalletEntry.countDocuments(filter),
  ]);
  return { data: rows.map(entryDto), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

/** Proof that a wallet equals its ledger: { ok, expected, actual } per bucket. */
export async function verifyWallet(sellerId) {
  const [wallet, sums] = await Promise.all([walletOf(sellerId), WalletEntry.aggregate([{ $match: { sellerId: String(sellerId) } }, { $group: { _id: '$bucket', total: { $sum: '$deltaPaise' } } }])]);
  const expected = Object.fromEntries(BUCKETS.map((bucket) => [bucket, sums.find((row) => row._id === bucket)?.total ?? 0]));
  const actual = Object.fromEntries(BUCKETS.map((bucket) => [bucket, wallet?.[`${bucket}Paise`] ?? 0]));
  return { ok: BUCKETS.every((bucket) => expected[bucket] === actual[bucket]), expected, actual };
}

/** An admin credits or debits a seller's available balance by hand (signed paise, a reason is required); audited. */
export async function adjustWallet(sellerId, { amountPaise, reason }, actor) {
  const profiles = await getSellerPayoutProfiles([sellerId]);
  if (!profiles.has(String(sellerId))) throw new NotFoundError('This seller does not exist.');
  if (!Number.isInteger(amountPaise) || amountPaise === 0) throw failure(422, 'AMOUNT_INVALID', 'Enter an amount other than zero.');
  const event = `ADJ:${sellerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await postOnce({ sellerId, event, type: 'ADJUSTMENT', moves: [{ bucket: 'available', deltaPaise: amountPaise }], refType: 'ADJUSTMENT', refId: event, note: reason, actorId: actor.userId, lifetime: { earned: amountPaise } });
  await recordAudit({ action: 'finance.wallet.adjust', subjectType: 'sellerWallet', subjectId: sellerId, after: { amountPaise }, reason, actor });
  return walletView(sellerId);
}

/** Admin: while a hold is on, the seller cannot request, be approved for, or be paid a withdrawal. Audited. */
export async function setPayoutHold(sellerId, { on, reason }, actor) {
  if (!(await setSellerPayoutHold(sellerId, on, reason))) throw new NotFoundError('This seller does not exist.');
  await recordAudit({ action: on ? 'finance.payout.hold' : 'finance.payout.release_hold', subjectType: 'seller', subjectId: sellerId, after: { on }, reason, actor });
  return { id: String(sellerId), payoutOnHold: on };
}
