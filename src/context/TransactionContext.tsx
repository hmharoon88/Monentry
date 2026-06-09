import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  addTransaction,
  calculateDayTotals,
  clearAllTransactions,
  deleteTransaction,
  getTransactionsForDay,
  getTransactionsForMonth,
  groupByCategory,
} from '../storage/transactions';
import {
  pushClearAll,
  pushDelete,
  pushTransaction,
} from '../sync/firestoreSync';
import { CategoryTotal, DayTotals, NewTransaction, Transaction } from '../types/transaction';

interface TransactionContextValue {
  todayTransactions: Transaction[];
  monthTransactions: Transaction[];
  todayTotals: DayTotals;
  monthTotals: DayTotals;
  categoryTotals: CategoryTotal[];
  loading: boolean;
  refresh: () => Promise<void>;
  createTransaction: (input: NewTransaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { user, syncEnabled, lastSyncedAt } = useAuth();
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [today, month] = await Promise.all([
      getTransactionsForDay(),
      getTransactionsForMonth(),
    ]);
    setTodayTransactions(today);
    setMonthTransactions(month);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, lastSyncedAt]);

  const createTransaction = useCallback(
    async (input: NewTransaction) => {
      const transaction = await addTransaction(input);

      if (syncEnabled && user) {
        await pushTransaction(user.uid, transaction);
      }

      await refresh();
    },
    [refresh, syncEnabled, user],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const deleted = await deleteTransaction(id);

      if (syncEnabled && user && deleted) {
        await pushDelete(user.uid, deleted.id, deleted.updatedAt);
      }

      await refresh();
    },
    [refresh, syncEnabled, user],
  );

  const clearAll = useCallback(async () => {
    const deleted = await clearAllTransactions();

    if (syncEnabled && user && deleted.length > 0) {
      await pushClearAll(
        user.uid,
        deleted.map((tx) => tx.id),
      );
    }

    await refresh();
  }, [refresh, syncEnabled, user]);

  const todayTotals = useMemo(
    () => calculateDayTotals(todayTransactions),
    [todayTransactions],
  );
  const monthTotals = useMemo(
    () => calculateDayTotals(monthTransactions),
    [monthTransactions],
  );
  const categoryTotals = useMemo(
    () => groupByCategory(monthTransactions),
    [monthTransactions],
  );

  const value = useMemo(
    () => ({
      todayTransactions,
      monthTransactions,
      todayTotals,
      monthTotals,
      categoryTotals,
      loading,
      refresh,
      createTransaction,
      removeTransaction,
      clearAll,
    }),
    [
      todayTransactions,
      monthTransactions,
      todayTotals,
      monthTotals,
      categoryTotals,
      loading,
      refresh,
      createTransaction,
      removeTransaction,
      clearAll,
    ],
  );

  return (
    <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within TransactionProvider');
  }
  return context;
}
