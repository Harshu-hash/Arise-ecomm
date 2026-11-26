import { ConflictError } from '../../../shared/errors/AppError.js';
import { WalletAccount } from '../infrastructure/persistence/walletAccount.model.js';
import { WalletEntry } from '../infrastructure/persistence/walletEntry.model.js';

// A customer's store credit (ADR-002): non-withdrawable, never edited, only appended to. `session` is a Mongo session; a debit
// must run inside a transaction (it consumes several lots), so a failure half-way leaves nothing behind.

const spendable = (userId, now = new Date()) => ({
  userId: String(userId),
  direction: 'CREDIT',
  remainingPaise: { $gt: 0 },
  $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

export async function getBalance(userId, session = null) {
  const [row] = await WalletEntry.aggregate([{ $match: spendable(userId) }, { $group: { _id: null, total: { $sum: '$remainingPaise' } } }]).session(session);
  return row?.total ?? 0;
}

export const isFrozen = async (userId) => Boolean(await WalletAccount.exists({ userId: String(userId), frozen: true }));

/** What the customer can spend now: nothing while the wallet is frozen (credits such as refunds still arrive). */
export async function getSpendableBalance(userId) {
  return (await isFrozen(userId)) ? 0 : getBalance(userId);
}

/** Admin freezes or unfreezes spending from a customer's wallet. */
export async function setWalletFrozen(userId, { frozen, reason }, actor) {
  await WalletAccount.updateOne({ userId: String(userId) }, { $set: { frozen, reason: frozen ? reason : null, changedBy: String(actor.userId), changedAt: new Date() } }, { upsert: true });
  return { frozen, reason: frozen ? reason : null };
}

export async function getWalletAccount(userId) {
  const account = await WalletAccount.findOne({ userId: String(userId) }).lean();
  return { frozen: Boolean(account?.frozen), frozenReason: account?.frozen ? account.reason : null };
}

/** Adds credit. Posting the same `key` again returns the first entry. `expiresAt` null never expires. */
export async function creditWallet({ userId, type, title, reference = null, amountPaise, expiresAt = null, key = undefined }, session = null) {
  if (key) {
    const posted = await WalletEntry.findOne({ key }).session(session);
    if (posted) return posted;
  }
  const balance = await getBalance(userId, session);
  const [entry] = await WalletEntry.create(
    [{ userId: String(userId), direction: 'CREDIT', type, title, reference, amountPaise, remainingPaise: amountPaise, expiresAt, balanceAfterPaise: balance + amountPaise, key }],
    { session },
  );
  return entry;
}

/** Spends credit, earliest-expiring first. Throws WALLET_INSUFFICIENT when the usable balance is short. */
export async function debitWallet({ userId, type, title, reference = null, amountPaise, key = undefined, allowFrozen = false }, session) {
  if (key) {
    const posted = await WalletEntry.findOne({ key }).session(session);
    if (posted) return posted;
  }
  if (!allowFrozen && (await isFrozen(userId))) throw new ConflictError('WALLET_FROZEN', 'Your wallet is on hold. Contact Arise support.');
  const lots = await WalletEntry.find(spendable(userId)).session(session);
  lots.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.createdAt - b.createdAt);
  let left = amountPaise;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.remainingPaise);
    // conditional, so two orders spending at once cannot both take the same credit (the loser's transaction aborts)
    const taken = await WalletEntry.updateOne({ _id: lot._id, remainingPaise: { $gte: take } }, { $inc: { remainingPaise: -take } }, { session });
    if (!taken.modifiedCount) break;
    left -= take;
  }
  if (left > 0) throw new ConflictError('WALLET_INSUFFICIENT', 'Your wallet balance is not enough for this order.');
  const balance = await getBalance(userId, session);
  const [entry] = await WalletEntry.create([{ userId: String(userId), direction: 'DEBIT', type, title, reference, amountPaise, balanceAfterPaise: balance, key }], { session });
  return entry;
}

export async function getWalletSummary(userId) {
  const now = new Date();
  const [availableBalancePaise, buckets, last] = await Promise.all([
    getBalance(userId),
    WalletEntry.aggregate([{ $match: { ...spendable(userId, now), expiresAt: { $gt: now } } }, { $group: { _id: '$expiresAt', amountPaise: { $sum: '$remainingPaise' } } }, { $sort: { _id: 1 } }]),
    WalletEntry.findOne({ userId: String(userId) }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    currency: 'INR',
    availableBalancePaise,
    ...(await getWalletAccount(userId)),
    pendingBalancePaise: 0,
    expiryBuckets: buckets.map((bucket) => ({ amountPaise: bucket.amountPaise, expiresAt: bucket._id.toISOString() })),
    updatedAt: (last?.createdAt ?? now).toISOString(),
  };
}

export async function listWalletTransactions(userId, { cursor = 0, limit = 20 } = {}) {
  const filter = { userId: String(userId) };
  const [rows, total] = await Promise.all([
    WalletEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(cursor).limit(limit).lean(),
    WalletEntry.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => ({
      id: String(row._id),
      direction: row.direction,
      type: row.type,
      title: row.title,
      reference: row.reference,
      amountPaise: row.amountPaise,
      status: 'COMPLETED',
      occurredAt: row.createdAt.toISOString(),
      balanceAfterPaise: row.balanceAfterPaise,
    })),
    total,
    nextCursor: cursor + limit < total ? String(cursor + limit) : null,
  };
}
