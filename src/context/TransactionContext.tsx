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
  getEarliestTransactionMonth,
  getTransactionsForDay,
  getTransactionsForMonth,
  groupByCategory,
} from '../storage/transactions';
import { addMonths, isMonthAfter, isMonthBefore, startOfMonth } from '../utils/date';
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
  summaryMonth: Date;
  canGoToPreviousMonth: boolean;
  canGoToNextMonth: boolean;
  isViewingCurrentMonth: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  createTransaction: (input: NewTransaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { user, syncEnabled, syncKey, lastSyncedAt } = useAuth();
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [summaryMonth, setSummaryMonth] = useState(() => startOfMonth());
  const [earliestMonth, setEarliestMonth] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [today, month, earliest] = await Promise.all([
      getTransactionsForDay(),
      getTransactionsForMonth(summaryMonth),
      getEarliestTransactionMonth(),
    ]);
    setTodayTransactions(today);
    setMonthTransactions(month);
    setEarliestMonth(earliest);
    setLoading(false);
  }, [summaryMonth]);

  useEffect(() => {
    refresh();
  }, [refresh, lastSyncedAt, user?.uid]);

  const canGoToPreviousMonth = Boolean(
    earliestMonth && isMonthAfter(summaryMonth, earliestMonth),
  );
  const canGoToNextMonth = isMonthBefore(summaryMonth, startOfMonth());
  const isViewingCurrentMonth = !canGoToNextMonth;

  const goToPreviousMonth = useCallback(() => {
    if (!canGoToPreviousMonth) {
      return;
    }
    setSummaryMonth((month) => addMonths(month, -1));
  }, [canGoToPreviousMonth]);

  const goToNextMonth = useCallback(() => {
    if (!canGoToNextMonth) {
      return;
    }
    setSummaryMonth((month) => addMonths(month, 1));
  }, [canGoToNextMonth]);

  const goToCurrentMonth = useCallback(() => {
    setSummaryMonth(startOfMonth());
  }, []);

  const createTransaction = useCallback(
    async (input: NewTransaction) => {
      const transaction = await addTransaction(input);

      if (syncEnabled && user && syncKey) {
        await pushTransaction(user.uid, syncKey, transaction);
      }

      await refresh();
    },
    [refresh, syncEnabled, syncKey, user],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const deleted = await deleteTransaction(id);

      if (syncEnabled && user && syncKey && deleted) {
        await pushDelete(user.uid, syncKey, deleted.id, deleted.updatedAt);
      }

      await refresh();
    },
    [refresh, syncEnabled, syncKey, user],
  );

  const clearAll = useCallback(async () => {
    const deleted = await clearAllTransactions();

    if (syncEnabled && user && syncKey && deleted.length > 0) {
      await pushClearAll(
        user.uid,
        syncKey,
        deleted.map((tx) => tx.id),
      );
    }

    await refresh();
  }, [refresh, syncEnabled, syncKey, user]);

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
      summaryMonth,
      canGoToPreviousMonth,
      canGoToNextMonth,
      isViewingCurrentMonth,
      loading,
      refresh,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
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
      summaryMonth,
      canGoToPreviousMonth,
      canGoToNextMonth,
      isViewingCurrentMonth,
      loading,
      refresh,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
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
