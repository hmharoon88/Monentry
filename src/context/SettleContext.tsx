import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SettleLedger } from '../types/settle';
import { isFirebaseConfigured } from '../config/firebase';
import { useAuth } from './AuthContext';
import {
  acceptSettleInvite,
  addSettleEntry,
  addSettleGroupEntry,
  approveCloseSettle,
  approveDeleteSettleEntry,
  approveSettleEntry,
  cancelSettleInvite,
  closeSettleLedger,
  createSettleInvite,
  rejectCloseSettle,
  rejectDeleteSettleEntry,
  rejectSettleEntry,
  requestCloseSettle,
  requestDeleteSettleEntry,
  SettleEntryDirection,
  subscribeToUserSettleLedgers,
} from '../sync/settleSync';

interface SettleContextValue {
  ledgers: SettleLedger[];
  loading: boolean;
  createInvite: (label?: string) => Promise<SettleLedger>;
  createGroupInvite: (label?: string) => Promise<SettleLedger>;
  acceptInvite: (code: string) => Promise<SettleLedger>;
  cancelInvite: (ledgerId: string) => Promise<void>;
  closeLedger: (ledgerId: string) => Promise<void>;
  requestClose: (ledgerId: string) => Promise<void>;
  approveClose: (ledgerId: string) => Promise<void>;
  rejectClose: (ledgerId: string) => Promise<void>;
  addEntry: (
    ledgerId: string,
    amount: number,
    direction: SettleEntryDirection,
    note?: string,
  ) => Promise<void>;
  addGroupEntry: (
    ledgerId: string,
    creditorUid: string,
    debtorUid: string,
    amount: number,
    note?: string,
  ) => Promise<void>;
  approveEntry: (ledgerId: string, entryId: string) => Promise<void>;
  rejectEntry: (ledgerId: string, entryId: string) => Promise<void>;
  requestDeleteEntry: (ledgerId: string, entryId: string) => Promise<void>;
  approveDeleteEntry: (ledgerId: string, entryId: string) => Promise<void>;
  rejectDeleteEntry: (ledgerId: string, entryId: string) => Promise<void>;
}

const SettleContext = createContext<SettleContextValue | null>(null);

export function SettleProvider({ children }: { children: ReactNode }) {
  const { user, tier } = useAuth();
  const [ledgers, setLedgers] = useState<SettleLedger[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setLedgers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToUserSettleLedgers(
        user.uid,
        (next) => {
          setLedgers(next);
          setLoading(false);
        },
        () => setLoading(false),
      );
    } catch {
      setLedgers([]);
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, [user]);

  const requireUser = useCallback(() => {
    if (!user) {
      throw new Error('Sign in to use Settle.');
    }
    return user;
  }, [user]);

  const createInvite = useCallback(
    async (label?: string) => {
      const current = requireUser();
      return createSettleInvite(current.uid, current.email ?? '', tier, label, 'pair');
    },
    [requireUser, tier],
  );

  const createGroupInvite = useCallback(
    async (label?: string) => {
      const current = requireUser();
      return createSettleInvite(current.uid, current.email ?? '', tier, label, 'group');
    },
    [requireUser, tier],
  );

  const acceptInvite = useCallback(
    async (code: string) => {
      const current = requireUser();
      return acceptSettleInvite(current.uid, current.email ?? '', code, tier);
    },
    [requireUser, tier],
  );

  const addEntry = useCallback(
    async (ledgerId: string, amount: number, direction: SettleEntryDirection, note?: string) => {
      const current = requireUser();
      await addSettleEntry(ledgerId, current.uid, tier, amount, direction, note);
    },
    [requireUser, tier],
  );

  const addGroupEntry = useCallback(
    async (
      ledgerId: string,
      creditorUid: string,
      debtorUid: string,
      amount: number,
      note?: string,
    ) => {
      const current = requireUser();
      await addSettleGroupEntry(
        ledgerId,
        current.uid,
        tier,
        creditorUid,
        debtorUid,
        amount,
        note,
      );
    },
    [requireUser, tier],
  );

  const approveEntry = useCallback(
    async (ledgerId: string, entryId: string) => {
      const current = requireUser();
      await approveSettleEntry(ledgerId, entryId, current.uid, tier);
    },
    [requireUser, tier],
  );

  const rejectEntry = useCallback(
    async (ledgerId: string, entryId: string) => {
      const current = requireUser();
      await rejectSettleEntry(ledgerId, entryId, current.uid, tier);
    },
    [requireUser, tier],
  );

  const requestDeleteEntry = useCallback(
    async (ledgerId: string, entryId: string) => {
      const current = requireUser();
      await requestDeleteSettleEntry(ledgerId, entryId, current.uid, tier);
    },
    [requireUser, tier],
  );

  const approveDeleteEntry = useCallback(
    async (ledgerId: string, entryId: string) => {
      const current = requireUser();
      await approveDeleteSettleEntry(ledgerId, entryId, current.uid, tier);
    },
    [requireUser, tier],
  );

  const rejectDeleteEntry = useCallback(
    async (ledgerId: string, entryId: string) => {
      const current = requireUser();
      await rejectDeleteSettleEntry(ledgerId, entryId, current.uid, tier);
    },
    [requireUser, tier],
  );

  const cancelInvite = useCallback(
    async (ledgerId: string) => {
      const current = requireUser();
      await cancelSettleInvite(current.uid, ledgerId, tier);
    },
    [requireUser, tier],
  );

  const closeLedger = useCallback(
    async (ledgerId: string) => {
      const current = requireUser();
      await closeSettleLedger(current.uid, ledgerId, tier);
    },
    [requireUser, tier],
  );

  const requestClose = useCallback(
    async (ledgerId: string) => {
      const current = requireUser();
      await requestCloseSettle(current.uid, ledgerId, tier);
    },
    [requireUser, tier],
  );

  const approveClose = useCallback(
    async (ledgerId: string) => {
      const current = requireUser();
      await approveCloseSettle(current.uid, ledgerId, tier);
    },
    [requireUser, tier],
  );

  const rejectClose = useCallback(
    async (ledgerId: string) => {
      const current = requireUser();
      await rejectCloseSettle(current.uid, ledgerId, tier);
    },
    [requireUser, tier],
  );

  const value = useMemo(
    () => ({
      ledgers,
      loading,
      createInvite,
      createGroupInvite,
      acceptInvite,
      cancelInvite,
      closeLedger,
      requestClose,
      approveClose,
      rejectClose,
      addEntry,
      addGroupEntry,
      approveEntry,
      rejectEntry,
      requestDeleteEntry,
      approveDeleteEntry,
      rejectDeleteEntry,
    }),
    [
      ledgers,
      loading,
      createInvite,
      createGroupInvite,
      acceptInvite,
      cancelInvite,
      closeLedger,
      requestClose,
      approveClose,
      rejectClose,
      addEntry,
      addGroupEntry,
      approveEntry,
      rejectEntry,
      requestDeleteEntry,
      approveDeleteEntry,
      rejectDeleteEntry,
    ],
  );

  return <SettleContext.Provider value={value}>{children}</SettleContext.Provider>;
}

export function useSettle(): SettleContextValue {
  const context = useContext(SettleContext);
  if (!context) {
    throw new Error('useSettle must be used within SettleProvider');
  }
  return context;
}
