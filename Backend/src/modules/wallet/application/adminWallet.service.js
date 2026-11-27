import { withTransaction } from '../../../config/database.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { getCustomer } from '../../identity/public/index.js';
import { CATEGORY, notify } from '../../notification/public/index.js';
import { creditWallet, debitWallet, getBalance, getWalletAccount, listWalletTransactions, setWalletFrozen } from './wallet.service.js';

async function assertCustomer(userId) {
  const customer = await getCustomer(userId);
  if (!customer) throw new NotFoundError('That customer no longer exists.');
  return customer;
}

/** One customer's wallet for the console: balance plus a page of the ledger. */
export async function adminWalletView(userId, { cursor = 0, limit = 20 } = {}) {
  await assertCustomer(userId);
  const [balancePaise, account, ledger] = await Promise.all([getBalance(userId), getWalletAccount(userId), listWalletTransactions(userId, { cursor, limit })]);
  return { balancePaise, ...account, ...ledger };
}

/** A manual credit (positive) or debit (negative) with a reason; a debit can never take the balance below zero. Audited. */
export async function adjustCustomerWallet(userId, { amountPaise, reason }, actor) {
  await assertCustomer(userId);
  const base = { userId, type: 'ADJUSTMENT', title: amountPaise > 0 ? 'Credit from Arise' : 'Adjustment by Arise', reference: reason, amountPaise: Math.abs(amountPaise) };
  if (amountPaise > 0) await creditWallet(base);
  else await withTransaction((session) => debitWallet({ ...base, allowFrozen: true }, session)); // an admin can still correct a frozen wallet
  await notify({
    to: { type: 'CUSTOMER', id: userId }, category: CATEGORY.ACCOUNT, key: `wallet-adjust:${userId}:${Date.now()}`,
    title: amountPaise > 0 ? 'Wallet credited' : 'Wallet adjusted',
    body: `${amountPaise > 0 ? `₹${(amountPaise / 100).toLocaleString('en-IN')} was added to` : `₹${(-amountPaise / 100).toLocaleString('en-IN')} was deducted from`} your wallet by Arise: ${reason}`,
  });
  await recordAudit({ action: 'wallet.adjust', subjectType: 'customerWallet', subjectId: String(userId), after: { amountPaise }, reason, actor });
  return adminWalletView(userId);
}

export async function freezeCustomerWallet(userId, { frozen, reason }, actor) {
  await assertCustomer(userId);
  const result = await setWalletFrozen(userId, { frozen, reason }, actor);
  await recordAudit({ action: frozen ? 'wallet.freeze' : 'wallet.unfreeze', subjectType: 'customerWallet', subjectId: String(userId), reason, actor });
  return result;
}
