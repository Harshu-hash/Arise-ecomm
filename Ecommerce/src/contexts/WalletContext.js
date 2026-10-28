import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TRANSACTIONS } from '../features/wallet/data/walletData';

const WalletContext = createContext(null);

const INITIAL_BALANCE = 391;
const INITIAL_COINS = 0;

function formatNow() {
  return new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Mounted at the app root so the wallet balance/transactions are real shared
 * state instead of the screen's own hardcoded constants — Add Money and any
 * future debit (e.g. paying for an order with wallet balance) both read and
 * write this single source of truth.
 */
export const WalletProvider = ({ children }) => {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [coins] = useState(INITIAL_COINS);
  const [transactions, setTransactions] = useState(TRANSACTIONS);

  const addMoney = useCallback((amount, methodTitle) => {
    setBalance((prev) => prev + amount);
    setTransactions((prev) => [
      { id: `t${Date.now()}`, type: 'credit', title: 'Added Money', subtitle: `via ${methodTitle}`, date: formatNow(), amount },
      ...prev,
    ]);
  }, []);

  const debit = useCallback((amount, title, subtitle) => {
    setBalance((prev) => Math.max(0, prev - amount));
    setTransactions((prev) => [
      { id: `t${Date.now()}`, type: 'debit', title, subtitle, date: formatNow(), amount },
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({ balance, coins, transactions, addMoney, debit }),
    [balance, coins, transactions, addMoney, debit]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => useContext(WalletContext);
