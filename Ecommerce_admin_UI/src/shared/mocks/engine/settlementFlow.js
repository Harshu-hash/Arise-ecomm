/**
 * Per-order-item seller settlement flow (the payout flow).
 *
 * A seller is paid for one delivered order item, but only once that item's
 * return window — set by its category's policy — has closed and no return,
 * claim or hold is standing in the way. This is the per-line equivalent of the
 * reference marketplace's settlement state machine.
 *
 *   WINDOW_OPEN → HELD → READY → REVIEWED → PAYING → SETTLED | FAILED
 *
 * Pure functions, no DB access, so the handlers and any preview calculator
 * share one source of truth. All money is integer paise.
 */

export const SETTLEMENT_STATE = {
  WINDOW_OPEN: 'WINDOW_OPEN',
  HELD: 'HELD',
  READY: 'READY',
  REVIEWED: 'REVIEWED',
  PAYING: 'PAYING',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
};

export const PAYOUT_MODE = { MANUAL: 'MANUAL', AUTOMATIC: 'AUTOMATIC' };

/** Admin-entered deduction buckets, mirrored from the reference BRD. */
export const DEDUCTION_FIELDS = [
  ['packing', 'Packing'],
  ['quality', 'Quality issue'],
  ['priceMismatch', 'Price mismatch'],
  ['extra', 'Extra charge'],
  ['misc', 'Miscellaneous'],
];

const OPEN_RETURN_STATES = ['CLOSED', 'RETURN_REJECTED', 'RETURN_CANCELLED'];

export function isReturnOpen(returns, orderItemId) {
  return returns.some(
    (r) => r.orderItemId === orderItemId && !OPEN_RETURN_STATES.includes(r.status),
  );
}

/** Total of the admin deductions entered against a line. */
export function deductionsTotal(line) {
  const d = line.deductions || {};
  return DEDUCTION_FIELDS.reduce((sum, [k]) => sum + Math.max(0, Number(d[k]) || 0), 0);
}

/** The seller's quoted amount for this item = its frozen net payable. */
export function quotedPaise(line) {
  return Math.max(0, line.netPaise ?? 0);
}

/** settled = quoted − deductions (never below zero). */
export function settledPaise(line) {
  return Math.max(0, quotedPaise(line) - deductionsTotal(line));
}

/**
 * The four readiness checks. Each: { key, label, dot:'g'|'a'|'r', ok, tooltip }.
 * green = clear · amber = waiting on the return window · red = needs action.
 */
export function computeChecks({ line, item, seller, returnOpen, now }) {
  const delivered = item ? item.status === 'DELIVERED' : true;
  const windowEnds = item?.returnWindowEndsAt ? new Date(item.returnWindowEndsAt).getTime() : null;
  const windowOpen = windowEnds ? now < windowEnds : false;
  const onHold = Boolean(seller?.payoutOnHold) || Boolean(line.manualHold);

  let returnDot;
  if (returnOpen) returnDot = 'r';
  else if (windowOpen) returnDot = 'a';
  else returnDot = 'g';

  const dots = [
    {
      key: 'delivered',
      label: 'Delivered',
      dot: delivered ? 'g' : 'r',
      ok: delivered,
      tooltip: delivered ? 'Item delivered' : 'Not delivered yet',
    },
    {
      key: 'payment',
      label: 'Payment received',
      dot: 'g',
      ok: true,
      tooltip: 'Customer payment confirmed',
    },
    {
      key: 'window',
      label: 'Return window closed',
      dot: returnDot,
      ok: returnDot === 'g',
      tooltip:
        returnDot === 'r'
          ? 'A return is open on this item — settlement held'
          : returnDot === 'a'
            ? `Return window open until ${windowEnds ? new Date(windowEnds).toLocaleDateString('en-IN') : ''}`
            : 'Return window has closed',
    },
    {
      key: 'hold',
      label: 'No hold',
      dot: onHold ? 'r' : 'g',
      ok: !onHold,
      tooltip: onHold ? (line.manualHoldReason || seller?.payoutHoldReason || 'Payouts on hold') : 'No hold',
    },
  ];

  return { dots, ready: dots.every((d) => d.dot === 'g'), windowEnds, windowOpen };
}

/** Resolves the settlement state from a line, its checks and paid status. */
export function resolveState(line, checks) {
  if (line.settledAt) return SETTLEMENT_STATE.SETTLED;
  if (line.payoutState === SETTLEMENT_STATE.FAILED) return SETTLEMENT_STATE.FAILED;
  if (line.payoutState === SETTLEMENT_STATE.PAYING) return SETTLEMENT_STATE.PAYING;
  if (checks.dots.find((d) => d.key === 'hold')?.dot === 'r') return SETTLEMENT_STATE.HELD;
  if (checks.dots.find((d) => d.key === 'window')?.dot === 'r') return SETTLEMENT_STATE.HELD;
  if (checks.windowOpen) return SETTLEMENT_STATE.WINDOW_OPEN;
  if (line.reviewed) return SETTLEMENT_STATE.REVIEWED;
  return checks.ready ? SETTLEMENT_STATE.READY : SETTLEMENT_STATE.WINDOW_OPEN;
}
