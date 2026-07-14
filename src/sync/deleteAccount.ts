import { deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../config/firebase';
import { leaveHousehold } from './householdSync';
import { userDocRef } from './firestoreSync';

const BATCH_LIMIT = 450;

async function deleteUserTransactions(uid: string): Promise<void> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'users', uid, 'transactions'));
  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(getFirebaseDb());
  let count = 0;

  for (const entry of snapshot.docs) {
    batch.delete(entry.ref);
    count += 1;

    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(getFirebaseDb());
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await leaveHousehold(uid);
  await deleteUserTransactions(uid);
  await deleteDoc(userDocRef(uid));

  const authUser = getFirebaseAuth().currentUser;
  if (!authUser || authUser.uid !== uid) {
    throw new Error('Session expired. Sign in again, then delete your account.');
  }

  try {
    await deleteUser(authUser);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'auth/requires-recent-login') {
      throw new Error('For security, sign out, sign in again, then delete your account.');
    }
    throw error;
  }
}
