import { randomInt } from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getAddressKeys } from '../../customer/public/index.js';
import { getUserSummaries } from '../../identity/public/index.js';
import { CATEGORY, getDeviceIds, notify } from '../../notification/public/index.js';
import { creditWallet } from '../../wallet/public/index.js';
import { Referral, ReferralCode, REFERRAL_STATUS } from '../infrastructure/persistence/referral.models.js';

// Refer & Earn: a customer shares a code; when the invited friend's first qualifying order is delivered, both get wallet credit.
// Everything the admin tunes lives in the 'referral' settings section; the amounts are frozen on each referral when it qualifies.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const makeCode = () => `ARS${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const config = () => getSettingsSection('referral');

export async function getOrCreateCode(userId) {
  const id = String(userId);
  const found = await ReferralCode.findOne({ userId: id }).lean();
  if (found) return found.code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return (await ReferralCode.create({ userId: id, code: makeCode() })).code;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const raced = await ReferralCode.findOne({ userId: id }).lean(); // another request made this user's code meanwhile
      if (raced) return raced.code;
    }
  }
  throw new ConflictError('REFERRAL_CODE_UNAVAILABLE', 'Could not create your invite code. Try again.');
}

const normalise = (code) => String(code ?? '').trim().toUpperCase();

/** Signup asks first, so a mistyped code is fixed before the OTP. Returns the normalised code, or null when none was given or the program is off. */
export async function checkSignupCode(code) {
  const value = normalise(code);
  if (!value || !(await config()).enabled) return null;
  if (!(await ReferralCode.exists({ code: value }))) throw new ValidationError('That referral code is not valid.', { referralCode: ['That referral code is not valid.'] });
  return value;
}

/** Links a new customer to whoever invited them. Never blocks signup: a problem here is logged and the account is created anyway. */
export async function attachReferral({ code, refereeId }) {
  try {
    const owner = await ReferralCode.findOne({ code: normalise(code) }).lean();
    if (!owner || owner.userId === String(refereeId)) return null;
    const referral = await Referral.create({ referrerId: owner.userId, refereeId: String(refereeId), code: owner.code });
    await notify({ to: { type: 'CUSTOMER', id: owner.userId }, category: CATEGORY.ACCOUNT, key: `referral-joined:${referral._id}`, title: 'A friend joined with your code', body: 'You earn your reward once their first order is delivered.' });
    return referral;
  } catch (err) {
    if (err?.code !== 11000) logger.error({ err }, 'Could not record the referral');
    return null;
  }
}

const overlap = (a, b) => [...a].some((value) => b.has(value));
const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Signs that the two accounts are one household or one phone: they share an app install, or the friend's saved or delivery address is the referrer's. */
export async function fraudSignals(referrerId, refereeId, orderAddress = null) {
  const ids = [String(referrerId), String(refereeId)];
  const [devices, addresses] = await Promise.all([getDeviceIds(ids), getAddressKeys(ids)]);
  const flags = [];
  if (overlap(devices.get(ids[0]), devices.get(ids[1]))) flags.push('SAME_DEVICE');
  const delivery = orderAddress ? new Set([`${squash(orderAddress.line)}|${orderAddress.pincode}`]) : new Set();
  if (overlap(addresses.get(ids[0]), addresses.get(ids[1])) || overlap(addresses.get(ids[0]), delivery)) flags.push('SAME_ADDRESS');
  return flags;
}

async function payOut(referral) {
  const { rewardExpiryDays } = await config();
  const expiresAt = rewardExpiryDays ? new Date(Date.now() + rewardExpiryDays * 86_400_000) : null;
  const id = String(referral._id);
  // keyed, so a retry after a crash between the two credits never pays twice
  if (referral.referrerRewardPaise > 0) await creditWallet({ userId: referral.referrerId, type: 'REFERRAL', title: 'Referral reward', reference: 'Friend placed their first order', amountPaise: referral.referrerRewardPaise, expiresAt, key: `referral:${id}:referrer` });
  if (referral.refereeRewardPaise > 0) await creditWallet({ userId: referral.refereeId, type: 'REFERRAL', title: 'Welcome reward', reference: 'You joined with a friend\'s invite', amountPaise: referral.refereeRewardPaise, expiresAt, key: `referral:${id}:referee` });
  const done = await Referral.findOneAndUpdate({ _id: referral._id, status: REFERRAL_STATUS.QUALIFIED }, { $set: { status: REFERRAL_STATUS.REWARDED, rewardedAt: new Date() } }, { new: true });
  if (!done) return referral;
  const tell = (userId, amount, body) => amount > 0 && notify({ to: { type: 'CUSTOMER', id: userId }, category: CATEGORY.ACCOUNT, title: `${rupees(amount)} added to your wallet`, body, key: `referral:${id}:${userId}`, target: { type: 'NONE', entityId: null } });
  await Promise.all([
    tell(done.referrerId, done.referrerRewardPaise, 'Your friend\'s first order was delivered. Thanks for referring!'),
    tell(done.refereeId, done.refereeRewardPaise, 'Welcome reward for joining with an invite. Use it on your next order.'),
  ]);
  return done;
}

/**
 * Called when a parcel is delivered. If the buyer was invited and this order is big enough, their referral qualifies.
 * Never throws into the delivery; repeating it is harmless.
 */
export async function qualifyOnDelivered(order) {
  try {
    const referral = await Referral.findOne({ refereeId: String(order.customerId), status: REFERRAL_STATUS.PENDING });
    if (!referral) return;
    const settings = await config();
    if (!settings.enabled) return;
    const orderValuePaise = order.totals.subtotalPaise - order.totals.couponDiscountPaise;
    if (orderValuePaise < settings.minOrderPaise) return; // a later, bigger order can still qualify it
    const rewarded = await Referral.countDocuments({ referrerId: referral.referrerId, status: { $in: [REFERRAL_STATUS.QUALIFIED, REFERRAL_STATUS.REWARDED] } });
    if (settings.maxRewardsPerReferrer && rewarded >= settings.maxRewardsPerReferrer) {
      await Referral.updateOne({ _id: referral._id, status: REFERRAL_STATUS.PENDING }, { $set: { status: REFERRAL_STATUS.REJECTED, rejectReason: 'The referrer reached the reward limit.' } });
      return;
    }
    const flags = await fraudSignals(referral.referrerId, referral.refereeId, order.address);
    const qualified = await Referral.findOneAndUpdate(
      { _id: referral._id, status: REFERRAL_STATUS.PENDING },
      { $set: { status: REFERRAL_STATUS.QUALIFIED, orderId: String(order._id), orderValuePaise, referrerRewardPaise: settings.referrerRewardPaise, refereeRewardPaise: settings.refereeRewardPaise, qualifiedAt: new Date(), flags } },
      { new: true },
    );
    if (qualified && settings.autoApprove && !flags.length) await payOut(qualified); // a flagged one waits for a person, whatever the setting
  } catch (err) {
    logger.error({ err, orderId: String(order?._id) }, 'Could not process the referral for a delivered order');
  }
}

/* ------------------------------------------------------------------------------------------------- customer */

export async function getMyReferral(userId) {
  const id = String(userId);
  const [settings, code, groups, recent] = await Promise.all([
    config(),
    getOrCreateCode(id),
    Referral.aggregate([{ $match: { referrerId: id } }, { $group: { _id: '$status', count: { $sum: 1 }, earned: { $sum: '$referrerRewardPaise' } } }]),
    Referral.find({ referrerId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const by = Object.fromEntries(groups.map((group) => [group._id, group]));
  const names = await getUserSummaries(recent.map((row) => row.refereeId));
  const first = (userId) => String(names.get(userId)?.name ?? 'A friend').split(' ')[0];
  const reward = settings.referrerRewardPaise;
  return {
    enabled: settings.enabled,
    code,
    shareUrl: `${env.PUBLIC_ORIGIN.replace(/\/$/, '')}/invite/${code}`,
    shareMessage: `Join me on Arise with my code ${code}${settings.refereeRewardPaise ? ` and get ${rupees(settings.refereeRewardPaise)} in your wallet` : ''} after your first order.`,
    rewardAmountPaise: reward,
    friendRewardPaise: settings.refereeRewardPaise,
    minOrderPaise: settings.minOrderPaise,
    successfulReferrals: by.REWARDED?.count ?? 0,
    pendingReferrals: (by.PENDING?.count ?? 0) + (by.QUALIFIED?.count ?? 0),
    earnedAmountPaise: by.REWARDED?.earned ?? 0,
    termsSummary: settings.terms || `Your friend must place an order of ${rupees(settings.minOrderPaise)} or more and receive it. Rewards are wallet credit${settings.rewardExpiryDays ? ` valid for ${settings.rewardExpiryDays} days` : ''}.`,
    referrals: recent.map((row) => ({ id: String(row._id), friendName: first(row.refereeId), status: row.status, rewardPaise: row.status === REFERRAL_STATUS.REWARDED ? row.referrerRewardPaise : 0, joinedAt: row.createdAt.toISOString() })),
  };
}

/* ------------------------------------------------------------------------------------------------- admin */

export async function listReferrals({ status = null, page = 1, limit = 20 }) {
  const filter = status ? { status } : {};
  const [rows, total, groups] = await Promise.all([
    Referral.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Referral.countDocuments(filter),
    Referral.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, referrer: { $sum: { $cond: [{ $eq: ['$status', 'REWARDED'] }, '$referrerRewardPaise', 0] } }, referee: { $sum: { $cond: [{ $eq: ['$status', 'REWARDED'] }, '$refereeRewardPaise', 0] } } } }]),
  ]);
  const people = await getUserSummaries([...new Set(rows.flatMap((row) => [row.referrerId, row.refereeId]))]);
  const who = (userId) => ({ id: userId, name: people.get(userId)?.name ?? 'Customer' });
  const counts = Object.fromEntries(groups.map((group) => [group._id, group.count]));
  return {
    items: rows.map((row) => ({
      id: String(row._id), status: row.status, code: row.code, flags: row.flags ?? [], referrer: who(row.referrerId), referee: who(row.refereeId),
      orderId: row.orderId, orderValuePaise: row.orderValuePaise, referrerRewardPaise: row.referrerRewardPaise, refereeRewardPaise: row.refereeRewardPaise,
      rejectReason: row.rejectReason, createdAt: row.createdAt.toISOString(), qualifiedAt: row.qualifiedAt?.toISOString() ?? null, rewardedAt: row.rewardedAt?.toISOString() ?? null,
    })),
    total,
    summary: { counts, rewardedPaise: groups.reduce((sum, group) => sum + group.referrer + group.referee, 0) },
  };
}

export async function decideReferral(id, { decision, reason }, actor) {
  const referral = await Referral.findById(id);
  if (!referral) throw new NotFoundError('That referral does not exist.');
  if (referral.status !== REFERRAL_STATUS.QUALIFIED) throw new ConflictError('ILLEGAL_TRANSITION', 'Only a qualified referral can be approved or rejected.');
  if (decision === 'REJECT') {
    await Referral.updateOne({ _id: id, status: REFERRAL_STATUS.QUALIFIED }, { $set: { status: REFERRAL_STATUS.REJECTED, rejectReason: reason, decidedBy: String(actor.userId) } });
  } else {
    await Referral.updateOne({ _id: id, status: REFERRAL_STATUS.QUALIFIED }, { $set: { decidedBy: String(actor.userId) } });
    await payOut(await Referral.findById(id));
  }
  await recordAudit({ action: `referral.${decision.toLowerCase()}`, subjectType: 'referral', subjectId: String(id), after: { decision, reason: reason ?? null }, actor });
  return { id: String(id), status: (await Referral.findById(id).lean()).status };
}

/** One customer's side of the program for the console: who invited them, and everyone they invited with the fraud signals seen. */
export async function getCustomerReferrals(userId) {
  const id = String(userId);
  const [owned, referredBy, invited] = await Promise.all([ReferralCode.findOne({ userId: id }).lean(), Referral.findOne({ refereeId: id }).lean(), Referral.find({ referrerId: id }).sort({ createdAt: -1 }).limit(100).lean()]);
  const people = await getUserSummaries([...new Set([...(referredBy ? [referredBy.referrerId] : []), ...invited.map((row) => row.refereeId)])]);
  const row = (r, otherId) => ({ id: String(r._id), status: r.status, flags: r.flags ?? [], name: people.get(otherId)?.name ?? 'Customer', customerId: otherId, referrerRewardPaise: r.referrerRewardPaise, refereeRewardPaise: r.refereeRewardPaise, createdAt: r.createdAt.toISOString(), rejectReason: r.rejectReason });
  return {
    code: owned?.code ?? null,
    referredBy: referredBy ? row(referredBy, referredBy.referrerId) : null,
    invited: invited.map((r) => row(r, r.refereeId)),
    earnedPaise: invited.filter((r) => r.status === REFERRAL_STATUS.REWARDED).reduce((sum, r) => sum + r.referrerRewardPaise, 0),
  };
}

/** For the invite landing page: does this code exist, and who is inviting (first name only). */
export async function describeInvite(code) {
  const owner = await ReferralCode.findOne({ code: normalise(code) }).lean();
  if (!owner) return null;
  const [settings, people] = await Promise.all([config(), getUserSummaries([owner.userId])]);
  return { code: owner.code, enabled: settings.enabled, inviter: String(people.get(owner.userId)?.name ?? '').split(' ')[0] || null, friendRewardPaise: settings.refereeRewardPaise, minOrderPaise: settings.minOrderPaise };
}
