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
  getAllTransactions,
  getAllTransactionsForSync,
  upsertTransaction,
} from '../storage/transactions';
import { Transaction } from '../types/transaction';
import { UserProfile } from '../types/user';
import { toISODate } from '../utils/date';
import { mergeTransactionLists } from './merge';

function transactionsCollection(uid: string) {
  return collection(getFirebaseDb(), 'users', uid, 'transactions');
}

function userDocRef(uid: string) {
  return doc(getFirebaseDb(), 'users', uid);
}

function transactionDocRef(uid: string, id: string) {
  return doc(getFirebaseDb(), 'users', uid, 'transactions', id);
}

function toFirestoreTransaction(tx: Transaction) {
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

export function canSyncForAccount(firebaseReady: boolean, signedIn: boolean): boolean {
  return firebaseReady && signedIn;
}

export async function ensureUserProfile(uid: string, email: string): Promise<UserProfile> {
  const ref = userDocRef(uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();
    return {
      uid,
      email: String(data.email ?? email),
      tier: (data.tier as SubscriptionTier) ?? 'free',
      createdAt: String(data.createdAt ?? toISODate()),
      updatedAt: String(data.updatedAt ?? toISODate()),
    };
  }

  const now = toISODate();
  const profile: UserProfile = {
    uid,
    email,
    tier: 'free',
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

  const profile: UserProfile = {
    uid,
    email,
    tier,
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

  const data = snapshot.data();
  return {
    uid,
    email: String(data.email ?? ''),
    tier: (data.tier as SubscriptionTier) ?? 'free',
    createdAt: String(data.createdAt ?? toISODate()),
    updatedAt: String(data.updatedAt ?? toISODate()),
  };
}

export async function pullRemoteTransactions(uid: string): Promise<Transaction[]> {
  const snapshot = await getDocs(transactionsCollection(uid));
  return snapshot.docs.map((entry) => fromFirestoreTransaction(entry.data()));
}

export async function mergeRemoteIntoLocal(uid: string): Promise<void> {
  const [local, remote] = await Promise.all([
    getAllTransactionsForSync(),
    pullRemoteTransactions(uid),
  ]);
  const merged = mergeTransactionLists(local, remote);

  for (const tx of merged) {
    await upsertTransaction(tx);
  }
}

export async function pushLocalTransactions(uid: string): Promise<void> {
  const local = await getAllTransactionsForSync();

  await Promise.all(
    local.map((tx) =>
      setDoc(transactionDocRef(uid, tx.id), toFirestoreTransaction(tx), { merge: true }),
    ),
  );
}

export async function fullSync(uid: string): Promise<void> {
  await mergeRemoteIntoLocal(uid);
  await pushLocalTransactions(uid);
}

export async function pushTransaction(uid: string, tx: Transaction): Promise<void> {
  await setDoc(transactionDocRef(uid, tx.id), toFirestoreTransaction(tx), { merge: true });
}

export async function pushDelete(uid: string, id: string, deletedAt: string): Promise<void> {
  await setDoc(
    transactionDocRef(uid, id),
    {
      id,
      deletedAt,
      updatedAt: deletedAt,
    },
    { merge: true },
  );
}

export async function pushClearAll(uid: string, ids: string[]): Promise<void> {
  const deletedAt = toISODate();
  await Promise.all(
    ids.map((id) =>
      setDoc(
        transactionDocRef(uid, id),
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

export async function deleteRemoteTransaction(uid: string, id: string): Promise<void> {
  await deleteDoc(transactionDocRef(uid, id));
}

export function subscribeToRemoteTransactions(
  uid: string,
  onChange: () => void,
): Unsubscribe {
  return onSnapshot(transactionsCollection(uid), () => {
    onChange();
  });
}
