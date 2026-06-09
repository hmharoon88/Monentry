import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  addTransaction,
  calculateDayTotals,
  clearAllTransactions,
  deleteTransaction,
  getTransactionsForDay,
  getTransactionsForMonth,
  groupByCategory,
} from '../storage/transactions';
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
  }, [refresh]);

  const createTransaction = useCallback(
    async (input: NewTransaction) => {
      await addTransaction(input);
      await refresh();
    },
    [refresh],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      await refresh();
    },
    [refresh],
  );

  const clearAll = useCallback(async () => {
    await clearAllTransactions();
    await refresh();
  }, [refresh]);

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
