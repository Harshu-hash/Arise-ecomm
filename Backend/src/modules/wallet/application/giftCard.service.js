import { randomInt } from 'node:crypto';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { AppError, ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import { GIFT_CARD_STATUS, GiftCard } from '../infrastructure/persistence/giftCard.model.js';
import { creditWallet, getWalletSummary, listWalletTransactions } from './wallet.service.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const chunk = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const makeCode = () => `GC-${chunk()}-${chunk()}-${chunk()}`;
const makePin = () => String(randomInt(10_000)).padStart(4, '0');
const normalise = (code) => String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');
const invalid = () => new AppError({ code: 'GIFT_CARD_INVALID', status: 422, message: 'The gift card code or PIN is invalid.' }); // never says which one is wrong

/** A customer redeems a card: it is claimed first (so two people cannot both spend it), then credited once. */
export async function redeemGiftCard(userId, { code, pin }) {
  const card = await GiftCard.findOne({ code: normalise(code) });
  if (!card || card.pinHash !== sha256(String(pin ?? '').trim()) || card.status === GIFT_CARD_STATUS.BLOCKED) throw invalid();
  if (card.status === GIFT_CARD_STATUS.REDEEMED) throw new ConflictError('GIFT_CARD_REDEEMED', 'This gift card has already been redeemed.');
  if (card.expiresAt <= new Date()) throw new AppError({ code: 'GIFT_CARD_EXPIRED', status: 422, message: 'This gift card has expired.' });
  const claimed = await GiftCard.findOneAndUpdate(
    { _id: card._id, status: GIFT_CARD_STATUS.ACTIVE },
    { $set: { status: GIFT_CARD_STATUS.REDEEMED, redeemedBy: String(userId), redeemedAt: new Date() } },
    { new: true },
  );
  if (!claimed) throw new ConflictError('GIFT_CARD_REDEEMED', 'This gift card has already been redeemed.');
  try {
    const entry = await creditWallet({ userId, type: 'GIFT_CARD', title: 'Gift card redeemed', reference: claimed.code, amountPaise: claimed.amountPaise, key: `giftcard:${claimed._id}` });
    const [wallet, { items }] = await Promise.all([getWalletSummary(userId), listWalletTransactions(userId, { limit: 1 })]);
    return { transaction: items.find((item) => item.id === String(entry._id)) ?? items[0], wallet };
  } catch (error) {
    await GiftCard.updateOne({ _id: claimed._id, redeemedBy: String(userId) }, { $set: { status: GIFT_CARD_STATUS.ACTIVE, redeemedBy: null, redeemedAt: null } }); // nothing was credited: give the card back
    throw error;
  }
}

const adminView = (card) => ({
  id: String(card._id), code: card.code, amountPaise: card.amountPaise, status: card.status, expiresAt: card.expiresAt.toISOString(),
  batchNote: card.batchNote, createdAt: card.createdAt.toISOString(), redeemedBy: card.redeemedBy, redeemedAt: card.redeemedAt?.toISOString() ?? null,
});

/** Makes a batch. The PINs are returned here and nowhere else: only their hashes are stored. */
export async function generateGiftCards({ count, amountPaise, expiresAt, note = '' }, actor) {
  const made = [];
  while (made.length < count) {
    const need = count - made.length;
    const batch = Array.from({ length: need }, () => ({ code: makeCode(), pin: makePin() }));
    const docs = await GiftCard.insertMany(
      batch.map(({ code, pin }) => ({ code, pinHash: sha256(pin), amountPaise, expiresAt, batchNote: note, createdBy: String(actor.userId) })),
      { ordered: false },
    ).catch((error) => error.insertedDocs ?? (error.code === 11000 ? [] : Promise.reject(error))); // a code collision is retried with a fresh code
    const kept = new Set(docs.map((doc) => doc.code));
    made.push(...batch.filter((card) => kept.has(card.code)));
  }
  await recordAudit({ action: 'giftcard.generate', subjectType: 'giftcard', subjectId: made[0].code, after: { count, amountPaise, expiresAt, note }, actor });
  return made.map((card) => ({ ...card, amountPaise, expiresAt: expiresAt.toISOString() }));
}

export async function listGiftCards({ status = null, page = 1, limit = 20 }) {
  const filter = status ? { status } : {};
  const [rows, total] = await Promise.all([
    GiftCard.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    GiftCard.countDocuments(filter),
  ]);
  return { items: rows.map(adminView), total };
}

export async function blockGiftCard(id, actor) {
  const card = await GiftCard.findOneAndUpdate({ _id: id, status: GIFT_CARD_STATUS.ACTIVE }, { $set: { status: GIFT_CARD_STATUS.BLOCKED } }, { new: true }).lean();
  if (!card) {
    if (!(await GiftCard.exists({ _id: id }))) throw new NotFoundError('That gift card does not exist.');
    throw new ConflictError('ILLEGAL_TRANSITION', 'Only an unused gift card can be blocked.');
  }
  await recordAudit({ action: 'giftcard.block', subjectType: 'giftcard', subjectId: String(id), actor });
  return adminView(card);
}
