import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { SubscriptionTier } from '../constants/categories';
import { getFirebaseDb } from '../config/firebase';
import {
  getAllTransactionsForSync,
  upsertTransaction,
  wipeLocalTransactions,
} from '../storage/transactions';
import { Transaction } from '../types/transaction';
import { UserProfile } from '../types/user';
import { toISODate } from '../utils/date';
import { mergeTransactionLists } from './merge';

export function getSyncKey(uid: string, householdId?: string | null): string {
  return householdId ?? uid;
}

function transactionsCollection(uid: string, syncKey: string) {
  if (syncKey !== uid) {
    return collection(getFirebaseDb(), 'households', syncKey, 'transactions');
  }
  return collection(getFirebaseDb(), 'users', uid, 'transactions');
}

export function userDocRef(uid: string) {
  return doc(getFirebaseDb(), 'users', uid);
}

function transactionDocRef(uid: string, syncKey: string, id: string) {
  if (syncKey !== uid) {
    return doc(getFirebaseDb(), 'households', syncKey, 'transactions', id);
  }
  return doc(getFirebaseDb(), 'users', uid, 'transactions', id);
}

function toFirestoreTransaction(tx: Transaction, addedByUid?: string) {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    method: tx.method,
    place: tx.place,
    who: tx.who,
    note: tx.note,
    date: tx.date,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    deletedAt: tx.deletedAt ?? null,
    ...(addedByUid ? { addedByUid } : {}),
  };
}

function fromFirestoreTransaction(data: Record<string, unknown>): Transaction {
  return {
    id: String(data.id),
    type: data.type as Transaction['type'],
    amount: Number(data.amount),
    category: String(data.category),
    method: data.method ? String(data.method) : null,
    place: data.place ? String(data.place) : null,
    who: data.who ? String(data.who) : null,
    note: data.note ? String(data.note) : null,
    date: String(data.date),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt ?? data.createdAt),
    deletedAt: data.deletedAt ? String(data.deletedAt) : null,
  };
}

function profileFromDoc(uid: string, data: Record<string, unknown>, fallbackEmail = ''): UserProfile {
  return {
    uid,
    email: String(data.email ?? fallbackEmail),
    displayName: data.displayName ? String(data.displayName) : null,
    tier: (data.tier as SubscriptionTier) ?? 'free',
    householdId: data.householdId ? String(data.householdId) : null,
    createdAt: String(data.createdAt ?? toISODate()),
    updatedAt: String(data.updatedAt ?? toISODate()),
  };
}

export function canSyncForAccount(firebaseReady: boolean, signedIn: boolean): boolean {
  return firebaseReady && signedIn;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  options?: { displayName?: string | null },
): Promise<UserProfile> {
  const ref = userDocRef(uid);
  const existing = await getDoc(ref);
  const displayName = options?.displayName?.trim() || null;

  if (existing.exists()) {
    const data = existing.data() ?? {};

    if (displayName && !data.displayName) {
      const now = toISODate();
      await setDoc(
        ref,
        {
          displayName,
          updatedAt: now,
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return profileFromDoc(uid, { ...data, displayName, updatedAt: now }, email);
    }

    return profileFromDoc(uid, data, email);
  }

  const now = toISODate();
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    tier: 'free',
    householdId: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...profile,
    serverUpdatedAt: serverTimestamp(),
  });

  return profile;
}

export async function updateUserTier(uid: string, tier: SubscriptionTier): Promise<UserProfile> {
  const now = toISODate();
  const ref = userDocRef(uid);
  const existing = await getDoc(ref);
  const email = existing.exists() ? String(existing.data()?.email ?? '') : '';
  const householdId = existing.exists()
    ? existing.data()?.householdId
      ? String(existing.data()?.householdId)
      : null
    : null;

  const profile: UserProfile = {
    uid,
    email,
    tier,
    householdId,
    createdAt: existing.exists()
      ? String(existing.data()?.createdAt ?? now)
      : now,
    updatedAt: now,
  };

  await setDoc(
    ref,
    {
      ...profile,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return profile;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDocRef(uid));

  if (!snapshot.exists()) {
    return null;
  }

  return profileFromDoc(uid, snapshot.data());
}

export async function pullPersonalTransactions(uid: string): Promise<Transaction[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'users', uid, 'transactions'));
  return snapshot.docs.map((entry) => fromFirestoreTransaction(entry.data()));
}

export async function pullRemoteTransactions(uid: string, syncKey: string): Promise<Transaction[]> {
  const snapshot = await getDocs(transactionsCollection(uid, syncKey));
  return snapshot.docs.map((entry) => fromFirestoreTransaction(entry.data()));
}

export async function resetLocalFromRemote(uid: string, syncKey: string): Promise<void> {
  await wipeLocalTransactions();
  const remote = await pullRemoteTransactions(uid, syncKey);
  for (const tx of remote) {
    await upsertTransaction(tx);
  }
}

export async function mergeRemoteIntoLocal(uid: string, syncKey: string): Promise<void> {
  const [local, remote] = await Promise.all([
    getAllTransactionsForSync(),
    pullRemoteTransactions(uid, syncKey),
  ]);
  const merged = mergeTransactionLists(local, remote);

  for (const tx of merged) {
    await upsertTransaction(tx);
  }
}

export async function pushLocalTransactions(uid: string, syncKey: string): Promise<void> {
  const [local, remote] = await Promise.all([
    getAllTransactionsForSync(),
    pullRemoteTransactions(uid, syncKey),
  ]);
  const remoteById = new Map(remote.map((tx) => [tx.id, tx]));

  const writes = local.filter((tx) => {
    const existing = remoteById.get(tx.id);
    if (!existing) {
      return true;
    }

    return (
      existing.updatedAt !== tx.updatedAt ||
      existing.deletedAt !== tx.deletedAt ||
      existing.amount !== tx.amount ||
      existing.type !== tx.type ||
      existing.category !== tx.category
    );
  });

  if (writes.length === 0) {
    return;
  }

  await Promise.all(
    writes.map((tx) =>
      setDoc(
        transactionDocRef(uid, syncKey, tx.id),
        toFirestoreTransaction(tx, syncKey !== uid ? uid : undefined),
        { merge: true },
      ),
    ),
  );
}

export async function fullSync(uid: string, syncKey: string): Promise<void> {
  await mergeRemoteIntoLocal(uid, syncKey);
  await pushLocalTransactions(uid, syncKey);
}

export async function pushTransaction(
  uid: string,
  syncKey: string,
  tx: Transaction,
): Promise<void> {
  await setDoc(
    transactionDocRef(uid, syncKey, tx.id),
    toFirestoreTransaction(tx, syncKey !== uid ? uid : undefined),
    { merge: true },
  );
}

export async function pushDelete(
  uid: string,
  syncKey: string,
  id: string,
  deletedAt: string,
): Promise<void> {
  await setDoc(
    transactionDocRef(uid, syncKey, id),
    {
      id,
      deletedAt,
      updatedAt: deletedAt,
    },
    { merge: true },
  );
}

export async function pushClearAll(uid: string, syncKey: string, ids: string[]): Promise<void> {
  const deletedAt = toISODate();
  await Promise.all(
    ids.map((id) =>
      setDoc(
        transactionDocRef(uid, syncKey, id),
        {
          id,
          deletedAt,
          updatedAt: deletedAt,
        },
        { merge: true },
      ),
    ),
  );
}

export async function deleteRemoteTransaction(
  uid: string,
  syncKey: string,
  id: string,
): Promise<void> {
  await deleteDoc(transactionDocRef(uid, syncKey, id));
}

export function subscribeToRemoteTransactions(
  uid: string,
  syncKey: string,
  onChange: () => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    transactionsCollection(uid, syncKey),
    () => {
      onChange();
    },
    (error) => {
      onError?.(error);
    },
  );
}
