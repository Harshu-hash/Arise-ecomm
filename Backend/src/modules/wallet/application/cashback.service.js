import { logger } from '../../../config/logger.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { CashbackRule } from '../infrastructure/persistence/cashbackRule.model.js';
import { creditWallet } from './wallet.service.js';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const amountFor = (rule, valuePaise) => Math.min(rule.maxCashbackPaise, Math.floor((valuePaise * rule.pct) / 100));
const live = (now) => ({ paused: false, startsAt: { $lte: now }, endsAt: { $gt: now } });

/**
 * A parcel was delivered: pays the best fitting cashback rule into the buyer's wallet, once per parcel (keyed).
 * `valuePaise` is what the customer paid for the items (after discounts, before delivery and fees). Never throws into the delivery.
 */
export async function grantCashback({ userId, orderNumber, subOrderId, valuePaise }) {
  try {
    const now = new Date();
    const rules = await CashbackRule.find({ ...live(now), minOrderPaise: { $lte: valuePaise } }).lean();
    const best = rules.map((rule) => ({ rule, amount: amountFor(rule, valuePaise) })).filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount);
    for (const { rule, amount } of best) {
      // reserve the rule's budget atomically; a rule that has run out falls through to the next best one
      const reserved = await CashbackRule.updateOne(
        { _id: rule._id, $or: [{ budgetPaise: 0 }, { $expr: { $lte: [{ $add: ['$usedPaise', amount] }, '$budgetPaise'] } }] },
        { $inc: { usedPaise: amount, grants: 1 } },
      );
      if (!reserved.modifiedCount) continue;
      const key = `cashback:${subOrderId}`;
      const expiresAt = rule.creditExpiryDays ? new Date(now.getTime() + rule.creditExpiryDays * 86_400_000) : null;
      try {
        await creditWallet({ userId, type: 'CASHBACK', title: rule.name, reference: `Order ${orderNumber}`, amountPaise: amount, expiresAt, key });
      } catch (error) {
        await CashbackRule.updateOne({ _id: rule._id }, { $inc: { usedPaise: -amount, grants: -1 } });
        throw error;
      }
      await notify({ to: { type: 'CUSTOMER', id: userId }, category: CATEGORY.ACCOUNT, title: `${rupees(amount)} cashback in your wallet`, body: `${rule.name} on your order ${orderNumber}.`, key });
      return amount;
    }
    return 0;
  } catch (err) {
    logger.error({ err, subOrderId: String(subOrderId) }, 'Could not grant cashback for a delivered parcel');
    return 0;
  }
}

/* ------------------------------------------------------------------------------------------------- admin */

const status = (rule, now = new Date()) => (rule.paused ? 'PAUSED' : rule.endsAt <= now ? 'ENDED' : rule.startsAt > now ? 'SCHEDULED' : rule.budgetPaise && rule.usedPaise >= rule.budgetPaise ? 'EXHAUSTED' : 'ACTIVE');
const view = (rule) => ({
  id: String(rule._id), name: rule.name, pct: rule.pct, maxCashbackPaise: rule.maxCashbackPaise, minOrderPaise: rule.minOrderPaise, creditExpiryDays: rule.creditExpiryDays,
  budgetPaise: rule.budgetPaise, usedPaise: rule.usedPaise, grants: rule.grants, startsAt: rule.startsAt.toISOString(), endsAt: rule.endsAt.toISOString(), status: status(rule),
});

export async function listCashbackRules() {
  return (await CashbackRule.find({}).sort({ createdAt: -1 }).limit(200).lean()).map(view);
}

export async function createCashbackRule(input, actor) {
  const rule = await CashbackRule.create({ ...input, createdBy: String(actor.userId) });
  await recordAudit({ action: 'cashback.create', subjectType: 'cashbackRule', subjectId: String(rule._id), after: input, actor });
  return view(rule);
}

export async function updateCashbackRule(id, patch, actor) {
  const rule = await CashbackRule.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  if (!rule) throw new NotFoundError('That cashback rule does not exist.');
  await recordAudit({ action: 'cashback.edit', subjectType: 'cashbackRule', subjectId: String(id), after: patch, actor });
  return view(rule);
}

export async function togglePauseCashbackRule(id, actor) {
  const rule = await CashbackRule.findOneAndUpdate({ _id: id }, [{ $set: { paused: { $not: '$paused' } } }], { new: true });
  if (!rule) throw new NotFoundError('That cashback rule does not exist.');
  await recordAudit({ action: rule.paused ? 'cashback.pause' : 'cashback.resume', subjectType: 'cashbackRule', subjectId: String(id), actor });
  return view(rule);
}
