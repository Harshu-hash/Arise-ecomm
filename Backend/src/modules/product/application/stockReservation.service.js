import { withTransaction } from '../../../config/database.js';
import { ConflictError } from '../../../shared/errors/AppError.js';
import { availableUnits } from '../domain/services/stockRules.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { StockMovement } from '../infrastructure/persistence/stockMovement.model.js';
import { RESERVATION_STATUS as S, StockReservation } from '../infrastructure/persistence/stockReservation.model.js';

// Stock held while a checkout is paid for, so two shoppers cannot both buy the last unit.
//   hold    : checkout starts  -> offer.reserved += qty   (only if stock - reserved >= qty, checked in the same write)
//   commit  : payment succeeds -> offer.stock -= qty, offer.reserved -= qty, and a SALE line in the stock ledger
//   release : checkout fails or is cancelled before payment -> offer.reserved -= qty
//   expire  : a hold nobody paid for runs out (swept every minute) -> same as release
// `reference` names the checkout/order the units belong to. Every call is safe to repeat. Pass the caller's `session` to be
// part of its transaction (checkout does this); without one, each call runs in its own. Holds are all-or-nothing.

const run = (session, work) => (session ? work(session) : withTransaction(work));
const line = (reservation) => ({ offerId: String(reservation.offerId), qty: reservation.qty });

/**
 * Takes the units for every line, or none of them: when any line is short, nothing is held and the error lists every
 * short line (`details.lines`: offerId, requested, available, reason) so the cart can show all of them at once.
 * `lines` are { offerId, qty }, one per offer; holding the same reference again returns the existing hold.
 */
export function holdStock({ reference, customerId = null, lines, expiresAt }, session = null) {
  if (new Set(lines.map((entry) => String(entry.offerId))).size !== lines.length) throw new Error('holdStock: one line per offer');
  return run(session, async (s) => {
    const shortfalls = [];
    const fresh = [];
    const result = [];
    for (const { offerId, qty } of lines) {
      const existing = await StockReservation.findOne({ reference, offerId }).session(s).lean();
      if (existing) {
        if (existing.status !== S.HELD || existing.qty !== qty) {
          throw new ConflictError('RESERVATION_EXISTS', 'Stock for this checkout was already held differently.');
        }
        result.push(line(existing));
        continue;
      }
      const offer = await Offer.findOneAndUpdate(
        { _id: offerId, status: 'LIVE', $expr: { $gte: [{ $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] }, qty] } },
        { $inc: { reserved: qty } },
        { session: s, new: true, projection: 'sellerId' },
      ).lean();
      if (!offer) {
        const current = await Offer.findById(offerId, 'status stock reserved').session(s).lean();
        const live = current?.status === 'LIVE';
        shortfalls.push({ offerId: String(offerId), requested: qty, available: live ? availableUnits(current) : 0, reason: live ? 'INSUFFICIENT_STOCK' : 'OFFER_UNAVAILABLE' });
        continue;
      }
      fresh.push({ reference, offerId, sellerId: offer.sellerId, customerId, qty, expiresAt });
      result.push({ offerId: String(offerId), qty });
    }
    if (shortfalls.length) throw new ConflictError('INSUFFICIENT_STOCK', 'Some items are no longer available in the quantity requested.', { lines: shortfalls });
    if (fresh.length) await StockReservation.insertMany(fresh, { session: s });
    return result;
  });
}

/**
 * Payment succeeded: the held units are sold. Returns { committed, missing }: `missing` are lines that were not held any
 * more (expired or released before the payment landed): the caller must re-hold them or refund. Repeating it is harmless.
 */
export function commitStock({ reference }, session = null) {
  return run(session, async (s) => {
    const committed = [];
    const missing = [];
    for (const reservation of await StockReservation.find({ reference }).session(s).lean()) {
      if (reservation.status === S.COMMITTED) {
        committed.push(line(reservation));
        continue;
      }
      const flipped = reservation.status === S.HELD
        && await StockReservation.findOneAndUpdate({ _id: reservation._id, status: S.HELD }, { $set: { status: S.COMMITTED, settledAt: new Date() } }, { session: s }).lean();
      if (!flipped) {
        missing.push({ ...line(reservation), status: reservation.status });
        continue;
      }
      // version moves too, so a seller's stock edit made from an older view is refused instead of overwriting the sale
      const offer = await Offer.findOneAndUpdate(
        { _id: reservation.offerId },
        { $inc: { stock: -reservation.qty, reserved: -reservation.qty, version: 1 } },
        { session: s, new: true, projection: 'stock' },
      ).lean();
      await StockMovement.create(
        [{ offerId: reservation.offerId, sellerId: reservation.sellerId, type: 'SALE', qty: -reservation.qty, balanceAfter: offer.stock, reference, actorId: null, at: new Date() }],
        { session: s },
      );
      committed.push(line(reservation));
    }
    return { committed, missing };
  });
}

/** Checkout failed or was cancelled before payment: the held units go back on sale. Returns the lines released. */
export function releaseStock({ reference }, session = null) {
  return run(session, async (s) => {
    const released = [];
    for (const reservation of await StockReservation.find({ reference, status: S.HELD }).session(s).lean()) {
      const flipped = await StockReservation.findOneAndUpdate({ _id: reservation._id, status: S.HELD }, { $set: { status: S.RELEASED, settledAt: new Date() } }, { session: s }).lean();
      if (!flipped) continue;
      await Offer.updateOne({ _id: reservation.offerId }, { $inc: { reserved: -reservation.qty } }, { session: s });
      released.push(line(reservation));
    }
    return released;
  });
}

/** An order (or, with `offerIds`, just some of its lines) was cancelled before it shipped, came back undelivered (`type: 'RTO'`) or was returned and passed QC (`type: 'RETURN'`): the sold units go back on sale, with a line of that type in the stock ledger. */
export function returnStock({ reference, offerIds = null, type = 'CANCELLATION' }, session = null) {
  return run(session, async (s) => {
    const returned = [];
    for (const reservation of await StockReservation.find({ reference, status: S.COMMITTED, ...(offerIds ? { offerId: { $in: offerIds } } : {}) }).session(s).lean()) {
      const flipped = await StockReservation.findOneAndUpdate({ _id: reservation._id, status: S.COMMITTED }, { $set: { status: S.RETURNED, settledAt: new Date() } }, { session: s }).lean();
      if (!flipped) continue;
      const offer = await Offer.findOneAndUpdate({ _id: reservation.offerId }, { $inc: { stock: reservation.qty, version: 1 } }, { session: s, new: true, projection: 'stock' }).lean();
      await StockMovement.create(
        [{ offerId: reservation.offerId, sellerId: reservation.sellerId, type, qty: reservation.qty, balanceAfter: offer.stock, reference, actorId: null, at: new Date() }],
        { session: s },
      );
      returned.push(line(reservation));
    }
    return returned;
  });
}

/** Gives back holds nobody paid for in time. Run on a schedule; safe to run twice at once. Returns how many it expired. */
export async function expireStaleReservations(now = new Date(), limit = 200) {
  const stale = await StockReservation.find({ status: S.HELD, expiresAt: { $lte: now } }, '_id').sort({ expiresAt: 1 }).limit(limit).lean();
  let expired = 0;
  for (const { _id } of stale) {
    expired += await withTransaction(async (s) => {
      const reservation = await StockReservation.findOneAndUpdate(
        { _id, status: S.HELD, expiresAt: { $lte: now } },
        { $set: { status: S.EXPIRED, settledAt: now } },
        { session: s },
      ).lean();
      if (!reservation) return 0;
      await Offer.updateOne({ _id: reservation.offerId }, { $inc: { reserved: -reservation.qty } }, { session: s });
      return 1;
    });
  }
  return expired;
}
