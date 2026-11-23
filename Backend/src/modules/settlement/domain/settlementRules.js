// Seller wallet rules. Pure: no database, integer paise, every figure rounded where it is computed so a batch never drifts.
//
// One delivered item becomes one line whose net is frozen at delivery:
//   sale (what the customer paid for the item after its coupon share, GST inside)
//   - commission          snapshotted on the order item when it was bought (the leaf category's rate wins)
//   - closing fee         flat per item, from Settings > Seller settlement
//   - collection fee      % of the sale
//   - GST on those fees
//   - TCS                 GST s.52, % of the taxable value (sale without its GST)
//   - TDS                 income tax s.194-O, % of the taxable value
//   = net, credited to the seller's wallet as PENDING, released to AVAILABLE once the return window (plus buffer) closes.
// shortcut: the delivery charge is passed through (the seller invoices it, Arise pays the courier), so it is neither paid to the
// seller nor deducted; upgrade to a freight fee line once the courier's real charge is recorded per parcel.

export const BUCKETS = Object.freeze(['pending', 'available', 'locked']);

/** A return in any of these statuses is still going to cost the seller the item's money (rejected, failed QC, refunded and cancelled ones are not). */
export const OPEN_RETURN_STATUSES = Object.freeze(['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'QC_PASSED', 'REFUND_INITIATED']);

export const WITHDRAWAL = Object.freeze({ REQUESTED: 'REQUESTED', APPROVED: 'APPROVED', PAID: 'PAID', REJECTED: 'REJECTED', CANCELLED: 'CANCELLED' });
export const WITHDRAWAL_OPEN = Object.freeze([WITHDRAWAL.REQUESTED, WITHDRAWAL.APPROVED]);

const pct = (paise, percent) => Math.round((paise * percent) / 100);

/** The frozen money of one delivered item. `rates`: { closingFeePaise, collectionFeePct, gstOnFeesPct, tcsPct, tdsPct }. */
export function computeLine({ salePaise, gstPaise, commissionPaise, rates }) {
  const closingFeePaise = rates.closingFeePaise;
  const collectionFeePaise = pct(salePaise, rates.collectionFeePct);
  const feesBeforeTaxPaise = commissionPaise + closingFeePaise + collectionFeePaise;
  const gstOnFeesPaise = pct(feesBeforeTaxPaise, rates.gstOnFeesPct);
  const taxablePaise = salePaise - gstPaise;
  const tcsPaise = pct(taxablePaise, rates.tcsPct);
  const tdsPaise = pct(taxablePaise, rates.tdsPct);
  const netPaise = salePaise - feesBeforeTaxPaise - gstOnFeesPaise - tcsPaise - tdsPaise;
  // a negative net is shown, never clamped: finance needs to see fees that exceed the sale
  return { salePaise, commissionPaise, closingFeePaise, collectionFeePaise, feesBeforeTaxPaise, gstOnFeesPaise, tcsPaise, tdsPaise, netPaise, negative: netPaise < 0 };
}

/** Where one line stands. `returnOpen`: a return that will cost the seller this item's money is in progress. */
export function lineStateOf(line, { returnOpen = false } = {}) {
  if (line.reversedAt) return 'REVERSED';
  if (line.releasedAt) return 'AVAILABLE';
  if (returnOpen) return 'HELD';
  if (line.codPending && !line.codRemittedAt) return 'HELD'; // cash on delivery: the courier's cash has not reached Arise
  return 'PENDING';
}

/** Why a pending line has not been released yet, for the seller's screen (null when nothing stands in the way but time). */
export function holdReasonOf(line, { returnOpen = false } = {}) {
  if (line.reversedAt || line.releasedAt) return null;
  if (returnOpen) return 'A return is open on this item';
  if (line.codPending && !line.codRemittedAt) return 'Cash on delivery: waiting for the courier to remit the cash';
  return null;
}

/** What may be withdrawn: the available balance less the reserve a new seller keeps (never negative). */
export function withdrawableOf(availablePaise, reservePct) {
  const reserve = Math.min(Math.max(availablePaise, 0), Math.ceil((Math.max(availablePaise, 0) * reservePct) / 100));
  return { reservePaise: reserve, withdrawablePaise: Math.max(availablePaise, 0) - reserve };
}

/**
 * Whether a withdrawal request may be made, as the first reason it may not (null = fine).
 * `limits`: the admin's { minWithdrawalPaise, maxWithdrawalPaise, dailyWithdrawalLimitPaise, maxOpenWithdrawals }.
 */
export function withdrawalProblem({ amountPaise, withdrawablePaise, limits, requestedTodayPaise, openCount }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return ['AMOUNT_INVALID', 'Enter an amount to withdraw.'];
  if (amountPaise < limits.minWithdrawalPaise) return ['BELOW_MINIMUM', `The smallest withdrawal is ₹${limits.minWithdrawalPaise / 100}.`];
  if (amountPaise > limits.maxWithdrawalPaise) return ['ABOVE_MAXIMUM', `The largest single withdrawal is ₹${limits.maxWithdrawalPaise / 100}.`];
  if (openCount >= limits.maxOpenWithdrawals) return ['TOO_MANY_OPEN', 'You already have a withdrawal waiting to be processed.'];
  if (limits.dailyWithdrawalLimitPaise > 0 && requestedTodayPaise + amountPaise > limits.dailyWithdrawalLimitPaise) {
    return ['DAILY_LIMIT', `The daily withdrawal limit is ₹${limits.dailyWithdrawalLimitPaise / 100}.`];
  }
  if (amountPaise > withdrawablePaise) return ['INSUFFICIENT_BALANCE', 'That is more than your withdrawable balance.'];
  return null;
}
