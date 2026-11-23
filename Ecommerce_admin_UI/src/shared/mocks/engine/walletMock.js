import { filter } from '../db/store';

/**
 * Mock seller wallet and withdrawals (the real backend keeps a ledger; here balances are derived from the mock settlement lines).
 * Withdrawals live in this module, so they reset when the page reloads. Limits mirror the backend's Settings > Seller settlement defaults.
 */
export const LIMITS = { minWithdrawalPaise: 50_000, maxWithdrawalPaise: 5_000_000, dailyWithdrawalLimitPaise: 10_000_000, maxOpenWithdrawals: 1 };

export const withdrawals = [];
let counter = 1;

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);

export function walletFor(sellerId) {
  const lines = filter('settlementLines', (line) => line.sellerId === sellerId);
  const open = withdrawals.filter((w) => w.sellerId === sellerId && ['REQUESTED', 'APPROVED'].includes(w.status));
  const paid = withdrawals.filter((w) => w.sellerId === sellerId && w.status === 'PAID');
  const locked = sum(open, 'amountPaise');
  const earned = lines.filter((line) => !line.settledAt);
  const available = sum(earned.filter((line) => line.eligible), 'netPaise') - locked - sum(paid, 'amountPaise');
  return {
    sellerId,
    pendingPaise: sum(earned.filter((line) => !line.eligible), 'netPaise'),
    availablePaise: available,
    lockedPaise: locked,
    reservePaise: 0,
    withdrawablePaise: Math.max(available, 0),
    lifetimeEarnedPaise: sum(lines, 'netPaise'),
    lifetimeWithdrawnPaise: sum(paid, 'amountPaise') + sum(lines.filter((line) => line.settledAt), 'netPaise'),
    openWithdrawals: open.length,
    openWithdrawalPaise: locked,
    canWithdraw: available >= LIMITS.minWithdrawalPaise && open.length < LIMITS.maxOpenWithdrawals,
    blockedReason: null,
    bank: { verified: true, last4: '4321' },
    limits: LIMITS,
  };
}

export function requestWithdrawal(sellerId, sellerName, amountPaise, now) {
  const wallet = walletFor(sellerId);
  const problem = !Number.isInteger(amountPaise) || amountPaise < LIMITS.minWithdrawalPaise ? ['BELOW_MINIMUM', 'The amount is below the minimum withdrawal.']
    : amountPaise > LIMITS.maxWithdrawalPaise ? ['ABOVE_MAXIMUM', 'The amount is above the largest single withdrawal.']
      : wallet.openWithdrawals >= LIMITS.maxOpenWithdrawals ? ['TOO_MANY_OPEN', 'You already have a withdrawal waiting to be processed.']
        : amountPaise > wallet.withdrawablePaise ? ['INSUFFICIENT_BALANCE', 'That is more than your withdrawable balance.'] : null;
  if (problem) return { problem };
  const row = {
    id: `WD${counter}`, number: `WD-MOCK-${String(counter).padStart(4, '0')}`, sellerId, sellerName, amountPaise, status: 'REQUESTED',
    bank: { holder: sellerName, maskedAccount: '••4321', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' },
    requestedAt: now, approvedAt: null, paidAt: null, txnNo: '', utr: '', decisionReason: null, timeline: [{ status: 'REQUESTED', at: now, note: null }],
  };
  counter += 1;
  withdrawals.unshift(row);
  return { row };
}

/** Moves a withdrawal along one step; returns null when it is not in a status that allows it. */
export function moveWithdrawal(id, from, to, extra, now, note = null) {
  const row = withdrawals.find((w) => w.id === id);
  if (!row || !from.includes(row.status)) return null;
  Object.assign(row, extra, { status: to }, { timeline: [...row.timeline, { status: to, at: now, note }] });
  return row;
}

export const adminView = (row) => ({ ...row, allowedActions: { REQUESTED: ['APPROVE', 'REJECT'], APPROVED: ['PAY', 'REJECT'] }[row.status] ?? [] });
