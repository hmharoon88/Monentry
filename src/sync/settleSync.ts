import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { canCreateSettle } from '../constants/subscriptionAccess';
import { SubscriptionTier } from '../constants/categories';
import { getFirebaseDb } from '../config/firebase';
import { SettleBalance, SettleEntry, SettleEntryStatus, SettleLedger, SettleLedgerKind, SETTLE_GROUP_MAX, SETTLE_PAIR_MAX } from '../types/settle';
import { computeSettleBalance, isGroupFullySettled } from '../utils/settleBalance';
import { toISODate } from '../utils/date';
import { generateInviteCode } from '../utils/inviteCode';

function settleLedgerDocRef(id: string) {
  return doc(getFirebaseDb(), 'settleLedgers', id);
}

function settleEntriesCollection(ledgerId: string) {
  return collection(getFirebaseDb(), 'settleLedgers', ledgerId, 'entries');
}

function settleEntryDocRef(ledgerId: string, entryId: string) {
  return doc(getFirebaseDb(), 'settleLedgers', ledgerId, 'entries', entryId);
}

function fromLedgerDoc(id: string, data: Record<string, unknown>): SettleLedger {
  const kind = (data.kind as SettleLedgerKind) ?? 'pair';
  return {
    id,
    kind,
    maxMembers: Number(data.maxMembers ?? (kind === 'group' ? SETTLE_GROUP_MAX : SETTLE_PAIR_MAX)),
    participantIds: (data.participantIds as string[]) ?? [],
    participantEmails: (data.participantEmails as Record<string, string>) ?? {},
    inviteCode: String(data.inviteCode ?? ''),
    status: data.status as SettleLedger['status'],
    createdBy: String(data.createdBy),
    label: String(data.label ?? 'Settle'),
    closeRequestedBy: data.closeRequestedBy ? String(data.closeRequestedBy) : undefined,
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
  };
}

function fromEntryDoc(id: string, ledgerId: string, data: Record<string, unknown>): SettleEntry {
  return {
    id,
    ledgerId,
    creditorUid: String(data.creditorUid),
    debtorUid: String(data.debtorUid),
    amount: Number(data.amount),
    note: data.note ? String(data.note) : undefined,
    createdBy: String(data.createdBy),
    status: data.status as SettleEntryStatus,
    deleteRequestedBy: data.deleteRequestedBy ? String(data.deleteRequestedBy) : undefined,
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    resolvedAt: data.resolvedAt ? String(data.resolvedAt) : undefined,
  };
}

function toFirestoreSettleEntry(entry: SettleEntry): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: entry.id,
    ledgerId: entry.ledgerId,
    creditorUid: entry.creditorUid,
    debtorUid: entry.debtorUid,
    amount: entry.amount,
    createdBy: entry.createdBy,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };

  const note = entry.note?.trim();
  if (note) {
    data.note = note;
  }

  if (entry.deleteRequestedBy) {
    data.deleteRequestedBy = entry.deleteRequestedBy;
  }

  if (entry.resolvedAt) {
    data.resolvedAt = entry.resolvedAt;
  }

  return data;
}

function assertSettleCreateAccess(tier: SubscriptionTier): void {
  if (!canCreateSettle(tier)) {
    throw new Error('Starting Settle requires a Plus subscription.');
  }
}

function otherParticipant(ledger: SettleLedger, uid: string): string | null {
  if (ledger.kind === 'group') {
    return null;
  }
  return ledger.participantIds.find((id) => id !== uid) ?? null;
}

function assertLedgerParticipants(ledger: SettleLedger, creditorUid: string, debtorUid: string): void {
  if (creditorUid === debtorUid) {
    throw new Error('Choose two different people.');
  }
  if (!ledger.participantIds.includes(creditorUid) || !ledger.participantIds.includes(debtorUid)) {
    throw new Error('Both people must be in this Settle group.');
  }
}

export async function findSettleLedgerByInviteCode(code: string): Promise<SettleLedger | null> {
  const normalized = code.trim().toUpperCase();
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'settleLedgers'), where('inviteCode', '==', normalized)),
  );

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  return fromLedgerDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
}

export async function createSettleInvite(
  uid: string,
  email: string,
  tier: SubscriptionTier,
  label?: string,
  kind: SettleLedgerKind = 'pair',
): Promise<SettleLedger> {
  assertSettleCreateAccess(tier);

  const now = toISODate();
  const ledgerId = doc(collection(getFirebaseDb(), 'settleLedgers')).id;
  const inviteCode = generateInviteCode();
  const displayLabel =
    label?.trim() || (kind === 'group' ? 'Group Settle' : 'Friend');
  const maxMembers = kind === 'group' ? SETTLE_GROUP_MAX : SETTLE_PAIR_MAX;

  const ledger: SettleLedger = {
    id: ledgerId,
    kind,
    maxMembers,
    participantIds: [uid],
    participantEmails: { [uid]: email },
    inviteCode,
    status: 'pending',
    createdBy: uid,
    label: displayLabel,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(settleLedgerDocRef(ledgerId), {
    ...ledger,
    serverUpdatedAt: serverTimestamp(),
  });

  return ledger;
}

export async function acceptSettleInvite(
  uid: string,
  email: string,
  inviteCode: string,
  tier: SubscriptionTier,
): Promise<SettleLedger> {
  const ledger = await findSettleLedgerByInviteCode(inviteCode);
  if (!ledger) {
    throw new Error('Invite code not found. Check the code and try again.');
  }

  if (ledger.participantIds.includes(uid)) {
    throw new Error('You are already part of this Settle ledger.');
  }

  if (ledger.participantIds.length >= ledger.maxMembers) {
    throw new Error(`This Settle group is full (${ledger.maxMembers} people max).`);
  }

  if (ledger.kind === 'pair') {
    if (ledger.status !== 'pending') {
      throw new Error('This Settle invite is no longer available.');
    }
    if (ledger.participantIds.length >= SETTLE_PAIR_MAX) {
      throw new Error('This Settle ledger already has two people.');
    }
  } else if (!['pending', 'active'].includes(ledger.status)) {
    throw new Error('This Settle group is no longer accepting members.');
  }

  const now = toISODate();
  const participantIds = [...ledger.participantIds, uid].sort();
  const participantEmails = { ...ledger.participantEmails, [uid]: email };
  const nextStatus = participantIds.length >= SETTLE_PAIR_MAX || ledger.kind === 'group'
    ? 'active'
    : 'pending';

  await updateDoc(settleLedgerDocRef(ledger.id), {
    participantIds,
    participantEmails,
    status: nextStatus,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });

  return {
    ...ledger,
    participantIds,
    participantEmails,
    status: nextStatus,
    updatedAt: now,
  };
}

export async function declineSettleInvite(
  uid: string,
  inviteCode: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = await findSettleLedgerByInviteCode(inviteCode);
  if (!ledger) {
    throw new Error('Invite code not found.');
  }

  if (ledger.createdBy === uid) {
    throw new Error('You cannot decline your own invite.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledger.id), {
    status: 'declined',
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function getSettleLedger(ledgerId: string): Promise<SettleLedger | null> {
  const snapshot = await getDoc(settleLedgerDocRef(ledgerId));
  if (!snapshot.exists()) {
    return null;
  }
  return fromLedgerDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export function subscribeToSettleLedger(
  ledgerId: string,
  onChange: (ledger: SettleLedger | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    settleLedgerDocRef(ledgerId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      onChange(fromLedgerDoc(snapshot.id, snapshot.data() as Record<string, unknown>));
    },
    (error) => onError?.(error),
  );
}

async function fetchLedgerEntries(ledgerId: string): Promise<SettleEntry[]> {
  const snapshot = await getDocs(settleEntriesCollection(ledgerId));
  return snapshot.docs.map((docSnap) =>
    fromEntryDoc(docSnap.id, ledgerId, docSnap.data() as Record<string, unknown>),
  );
}

async function getLedgerBalanceState(
  ledger: SettleLedger,
  uid: string,
): Promise<{ balance: SettleBalance | null; hasOpenItems: boolean; groupSettled: boolean }> {
  const entries = await fetchLedgerEntries(ledger.id);
  const hasOpenItems = entries.some(
    (entry) => entry.status === 'pending' || entry.status === 'delete_pending',
  );
  const approvedEntries = entries.filter((entry) => entry.status === 'approved');

  if (ledger.kind === 'group') {
    return {
      balance: null,
      hasOpenItems,
      groupSettled: isGroupFullySettled(approvedEntries, ledger.participantIds),
    };
  }

  const otherUid = otherParticipant(ledger, uid);
  if (!otherUid) {
    return {
      balance: { theyOweMeCents: 0, iOweThemCents: 0, netCents: 0 },
      hasOpenItems,
      groupSettled: true,
    };
  }

  return {
    balance: computeSettleBalance(approvedEntries, uid, otherUid),
    hasOpenItems,
    groupSettled: true,
  };
}

function assertLedgerParticipant(ledger: SettleLedger | null, uid: string): SettleLedger {
  if (!ledger || !ledger.participantIds.includes(uid)) {
    throw new Error('You are not part of this Settle ledger.');
  }
  return ledger;
}

export async function cancelSettleInvite(
  uid: string,
  ledgerId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = assertLedgerParticipant(await getSettleLedger(ledgerId), uid);
  if (ledger.status !== 'pending') {
    throw new Error('Only pending invites can be cancelled.');
  }
  if (ledger.createdBy !== uid) {
    throw new Error('Only the person who sent the invite can cancel it.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledgerId), {
    status: 'cancelled',
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function closeSettleLedger(
  uid: string,
  ledgerId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = assertLedgerParticipant(await getSettleLedger(ledgerId), uid);
  if (ledger.status !== 'active') {
    throw new Error('This Settle ledger is not active.');
  }

  const { balance, hasOpenItems, groupSettled } = await getLedgerBalanceState(ledger, uid);
  if (hasOpenItems) {
    throw new Error('Approve or remove pending entries before closing.');
  }

  if (ledger.kind === 'group') {
    if (!groupSettled) {
      throw new Error('Everyone must be settled up before closing this group.');
    }
  } else if (balance?.netCents !== 0) {
    throw new Error('Request to close while there is still an outstanding balance.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledgerId), {
    status: 'closed',
    closeRequestedBy: null,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function requestCloseSettle(
  uid: string,
  ledgerId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = assertLedgerParticipant(await getSettleLedger(ledgerId), uid);
  if (ledger.kind === 'group') {
    throw new Error('Group Settle can only close when everyone is settled up.');
  }
  if (ledger.status !== 'active') {
    throw new Error('This Settle ledger is not active.');
  }

  const { balance, hasOpenItems } = await getLedgerBalanceState(ledger, uid);
  if (hasOpenItems) {
    throw new Error('Approve or remove pending entries before closing.');
  }
  if (!balance || balance.netCents === 0) {
    throw new Error('You are all settled up — use Close Settle instead.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledgerId), {
    status: 'close_pending',
    closeRequestedBy: uid,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function approveCloseSettle(
  uid: string,
  ledgerId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = assertLedgerParticipant(await getSettleLedger(ledgerId), uid);
  if (ledger.status !== 'close_pending') {
    throw new Error('There is no close request to approve.');
  }
  if (ledger.closeRequestedBy === uid) {
    throw new Error('You cannot approve your own close request.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledgerId), {
    status: 'closed',
    closeRequestedBy: null,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function rejectCloseSettle(
  uid: string,
  ledgerId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = assertLedgerParticipant(await getSettleLedger(ledgerId), uid);
  if (ledger.status !== 'close_pending') {
    throw new Error('There is no close request to reject.');
  }
  if (ledger.closeRequestedBy === uid) {
    throw new Error('You cannot reject your own close request.');
  }

  const now = toISODate();
  await updateDoc(settleLedgerDocRef(ledgerId), {
    status: 'active',
    closeRequestedBy: null,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}

export function subscribeToUserSettleLedgers(
  uid: string,
  onChange: (ledgers: SettleLedger[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getFirebaseDb(), 'settleLedgers'),
    where('participantIds', 'array-contains', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const ledgers = snapshot.docs
        .map((docSnap) => fromLedgerDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((ledger) => !['declined', 'cancelled', 'closed'].includes(ledger.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onChange(ledgers);
    },
    (error) => onError?.(error),
  );
}

export function subscribeToSettleEntries(
  ledgerId: string,
  onChange: (entries: SettleEntry[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    settleEntriesCollection(ledgerId),
    (snapshot) => {
      const entries = snapshot.docs
        .map((docSnap) =>
          fromEntryDoc(docSnap.id, ledgerId, docSnap.data() as Record<string, unknown>),
        )
        .filter((entry) => entry.status !== 'deleted' && entry.status !== 'rejected')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onChange(entries);
    },
    (error) => onError?.(error),
  );
}

export type SettleEntryDirection = 'they_owe_me' | 'i_owe_them';

export async function addSettleEntry(
  ledgerId: string,
  uid: string,
  tier: SubscriptionTier,
  amount: number,
  direction: SettleEntryDirection,
  note?: string,
): Promise<SettleEntry> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }

  const ledger = await getSettleLedger(ledgerId);
  if (!ledger || ledger.status !== 'active') {
    throw new Error('This Settle ledger is not active.');
  }

  if (ledger.kind === 'group') {
    throw new Error('Use group entry for this Settle.');
  }

  if (!ledger.participantIds.includes(uid)) {
    throw new Error('You are not part of this Settle ledger.');
  }

  const otherUid = otherParticipant(ledger, uid);
  if (!otherUid) {
    throw new Error('Waiting for the other person to join.');
  }

  const creditorUid = direction === 'they_owe_me' ? uid : otherUid;
  const debtorUid = direction === 'they_owe_me' ? otherUid : uid;
  const now = toISODate();
  const entryId = doc(settleEntriesCollection(ledgerId)).id;

  const entry: SettleEntry = {
    id: entryId,
    ledgerId,
    creditorUid,
    debtorUid,
    amount,
    note: note?.trim() || undefined,
    createdBy: uid,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(getFirebaseDb());
  batch.set(settleEntryDocRef(ledgerId, entryId), {
    ...toFirestoreSettleEntry(entry),
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(settleLedgerDocRef(ledgerId), {
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  await batch.commit();

  return entry;
}

export async function addSettleGroupEntry(
  ledgerId: string,
  uid: string,
  tier: SubscriptionTier,
  creditorUid: string,
  debtorUid: string,
  amount: number,
  note?: string,
): Promise<SettleEntry> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }

  const ledger = await getSettleLedger(ledgerId);
  if (!ledger || ledger.kind !== 'group' || ledger.status !== 'active') {
    throw new Error('This group Settle is not active.');
  }

  if (!ledger.participantIds.includes(uid)) {
    throw new Error('You are not part of this Settle group.');
  }

  if (ledger.participantIds.length < 2) {
    throw new Error('Waiting for more people to join.');
  }

  assertLedgerParticipants(ledger, creditorUid, debtorUid);

  const now = toISODate();
  const entryId = doc(settleEntriesCollection(ledgerId)).id;

  const entry: SettleEntry = {
    id: entryId,
    ledgerId,
    creditorUid,
    debtorUid,
    amount,
    note: note?.trim() || undefined,
    createdBy: uid,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(getFirebaseDb());
  batch.set(settleEntryDocRef(ledgerId, entryId), {
    ...toFirestoreSettleEntry(entry),
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(settleLedgerDocRef(ledgerId), {
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  await batch.commit();

  return entry;
}

async function resolveEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
  nextStatus: SettleEntryStatus,
): Promise<void> {
  const ledger = await getSettleLedger(ledgerId);
  if (!ledger || !ledger.participantIds.includes(uid)) {
    throw new Error('You are not part of this Settle ledger.');
  }

  const entrySnap = await getDoc(settleEntryDocRef(ledgerId, entryId));
  if (!entrySnap.exists()) {
    throw new Error('Entry not found.');
  }

  const entry = fromEntryDoc(entrySnap.id, ledgerId, entrySnap.data() as Record<string, unknown>);
  const now = toISODate();

  if (nextStatus === 'approved' || nextStatus === 'rejected') {
    if (entry.status !== 'pending') {
      throw new Error('This entry is no longer pending.');
    }
    if (entry.createdBy === uid) {
      throw new Error('You cannot approve your own entry.');
    }
  }

  if (nextStatus === 'deleted') {
    if (entry.status !== 'delete_pending') {
      throw new Error('This entry is not pending deletion.');
    }
    if (entry.deleteRequestedBy === uid) {
      throw new Error('You cannot approve your own deletion request.');
    }
  }

  const batch = writeBatch(getFirebaseDb());
  batch.update(settleEntryDocRef(ledgerId, entryId), {
    status: nextStatus,
    updatedAt: now,
    resolvedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(settleLedgerDocRef(ledgerId), {
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function approveSettleEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
): Promise<void> {
  await resolveEntry(ledgerId, entryId, uid, tier, 'approved');
}

export async function rejectSettleEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
): Promise<void> {
  await resolveEntry(ledgerId, entryId, uid, tier, 'rejected');
}

export async function requestDeleteSettleEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
): Promise<void> {
  const ledger = await getSettleLedger(ledgerId);
  if (!ledger || !ledger.participantIds.includes(uid)) {
    throw new Error('You are not part of this Settle ledger.');
  }

  const entrySnap = await getDoc(settleEntryDocRef(ledgerId, entryId));
  if (!entrySnap.exists()) {
    throw new Error('Entry not found.');
  }

  const entry = fromEntryDoc(entrySnap.id, ledgerId, entrySnap.data() as Record<string, unknown>);
  if (entry.status !== 'approved') {
    throw new Error('Only approved entries can be removed.');
  }

  const now = toISODate();
  const batch = writeBatch(getFirebaseDb());
  batch.update(settleEntryDocRef(ledgerId, entryId), {
    status: 'delete_pending',
    deleteRequestedBy: uid,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(settleLedgerDocRef(ledgerId), {
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function approveDeleteSettleEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
): Promise<void> {
  await resolveEntry(ledgerId, entryId, uid, tier, 'deleted');
}

export async function rejectDeleteSettleEntry(
  ledgerId: string,
  entryId: string,
  uid: string,
  tier: SubscriptionTier,
): Promise<void> {
  const entrySnap = await getDoc(settleEntryDocRef(ledgerId, entryId));
  if (!entrySnap.exists()) {
    throw new Error('Entry not found.');
  }

  const entry = fromEntryDoc(entrySnap.id, ledgerId, entrySnap.data() as Record<string, unknown>);
  if (entry.status !== 'delete_pending' || entry.deleteRequestedBy === uid) {
    throw new Error('You cannot restore this entry.');
  }

  const now = toISODate();
  await updateDoc(settleEntryDocRef(ledgerId, entryId), {
    status: 'approved',
    deleteRequestedBy: null,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
}
