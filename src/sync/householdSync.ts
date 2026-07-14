import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { SubscriptionTier } from '../constants/categories';
import { canCreateFamilyGroup, canCreatePartnerGroup, canCreateTeamGroup } from '../constants/subscriptionAccess';
import { getFirebaseDb } from '../config/firebase';
import { Household, HouseholdMember, HouseholdMode, HOUSEHOLD_LIMITS, defaultHouseholdName, householdModeLabel } from '../types/household';
import { toISODate } from '../utils/date';
import { generateInviteCode, normalizeInviteCode } from '../utils/inviteCode';
import { fetchUserProfile, pullPersonalTransactions, userDocRef } from './firestoreSync';

function householdDocRef(id: string) {
  return doc(getFirebaseDb(), 'households', id);
}

function householdInviteCodeDocRef(code: string) {
  return doc(getFirebaseDb(), 'householdInviteCodes', normalizeInviteCode(code));
}

function householdMembersCollection(id: string) {
  return collection(getFirebaseDb(), 'households', id, 'members');
}

function householdMemberDocRef(householdId: string, uid: string) {
  return doc(getFirebaseDb(), 'households', householdId, 'members', uid);
}

function householdTransactionDocRef(householdId: string, txId: string) {
  return doc(getFirebaseDb(), 'households', householdId, 'transactions', txId);
}

function fromHouseholdDoc(id: string, data: Record<string, unknown>): Household {
  return {
    id,
    name: String(data.name ?? 'Shared'),
    mode: data.mode as HouseholdMode,
    ownerUid: String(data.ownerUid),
    inviteCode: String(data.inviteCode),
    maxMembers: Number(data.maxMembers),
    memberCount: Number(data.memberCount ?? 1),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
  };
}

export function canCreatePartnerHousehold(tier: SubscriptionTier): boolean {
  return canCreatePartnerGroup(tier);
}

export function canCreateFamilyHousehold(tier: SubscriptionTier): boolean {
  return canCreateFamilyGroup(tier);
}

export function canCreateTeamHousehold(tier: SubscriptionTier): boolean {
  return canCreateTeamGroup(tier);
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  const snapshot = await getDoc(householdDocRef(householdId));
  if (!snapshot.exists()) {
    return null;
  }
  return fromHouseholdDoc(snapshot.id, snapshot.data());
}

export async function isUserHouseholdMember(householdId: string, uid: string): Promise<boolean> {
  const snapshot = await getDoc(householdMemberDocRef(householdId, uid));
  return snapshot.exists();
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const snapshot = await getDocs(householdMembersCollection(householdId));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      uid: entry.id,
      email: String(data.email ?? ''),
      role: data.role as HouseholdMember['role'],
      joinedAt: String(data.joinedAt),
    };
  });
}

function fromInviteDoc(householdId: string, data: Record<string, unknown>, fallbackCode: string): Household {
  return {
    id: householdId,
    name: String(data.name ?? 'Shared'),
    mode: (data.mode as HouseholdMode) ?? 'partner',
    ownerUid: String(data.ownerUid ?? ''),
    inviteCode: String(data.inviteCode ?? fallbackCode),
    maxMembers: Number(data.maxMembers ?? HOUSEHOLD_LIMITS.partner),
    memberCount: Number(data.memberCount ?? 1),
    createdAt: String(data.createdAt ?? toISODate()),
    updatedAt: String(data.updatedAt ?? toISODate()),
  };
}

async function findHouseholdByInviteCode(code: string): Promise<Household | null> {
  const normalized = normalizeInviteCode(code);
  const inviteSnapshot = await getDoc(householdInviteCodeDocRef(normalized));
  if (!inviteSnapshot.exists()) {
    return null;
  }

  const data = inviteSnapshot.data() as Record<string, unknown>;
  const householdId = String(data.householdId ?? '');
  if (!householdId) {
    return null;
  }

  return fromInviteDoc(householdId, data, normalized);
}

async function syncInviteCodeMemberCount(
  inviteCode: string,
  memberCount: number,
  updatedAt: string,
): Promise<void> {
  await updateDoc(householdInviteCodeDocRef(inviteCode), {
    memberCount,
    updatedAt,
    serverUpdatedAt: serverTimestamp(),
  });
}

async function copyPersonalTransactionsToHousehold(uid: string, householdId: string): Promise<void> {
  const personal = await pullPersonalTransactions(uid);
  if (personal.length === 0) {
    return;
  }

  const batch = writeBatch(getFirebaseDb());
  for (const tx of personal) {
    batch.set(householdTransactionDocRef(householdId, tx.id), {
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
      addedByUid: uid,
    });
  }
  await batch.commit();
}

export async function createHousehold(
  uid: string,
  email: string,
  mode: HouseholdMode,
  tier: SubscriptionTier,
  name?: string,
): Promise<Household> {
  const profile = await fetchUserProfile(uid);
  if (profile?.householdId) {
    throw new Error('Leave your current group before creating a new one.');
  }

  if (mode === 'partner' && !canCreatePartnerHousehold(tier)) {
    throw new Error('Partner sharing requires a Plus subscription.');
  }

  if (mode === 'family' && !canCreateFamilyHousehold(tier)) {
    throw new Error('Family sharing requires a Family subscription.');
  }

  if (mode === 'team' && !canCreateTeamHousehold(tier)) {
    throw new Error('Team sharing requires a Family subscription.');
  }

  const now = toISODate();
  const householdId = doc(collection(getFirebaseDb(), 'households')).id;
  const inviteCode = generateInviteCode();
  const maxMembers = HOUSEHOLD_LIMITS[mode];
  const displayName = name?.trim() || defaultHouseholdName(mode);

  const household: Household = {
    id: householdId,
    name: displayName,
    mode,
    ownerUid: uid,
    inviteCode,
    maxMembers,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(householdDocRef(householdId), {
    ...household,
    serverUpdatedAt: serverTimestamp(),
  });

  await setDoc(householdInviteCodeDocRef(inviteCode), {
    householdId,
    ownerUid: uid,
    inviteCode,
    name: displayName,
    mode,
    memberCount: 1,
    maxMembers,
    createdAt: now,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });

  await setDoc(householdMemberDocRef(householdId, uid), {
    email,
    role: 'owner',
    joinedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });

  await setDoc(
    userDocRef(uid),
    {
      householdId,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await copyPersonalTransactionsToHousehold(uid, householdId);

  return household;
}

export async function upgradeHouseholdMode(
  uid: string,
  tier: SubscriptionTier,
  targetMode: 'family' | 'team',
): Promise<Household> {
  const profile = await fetchUserProfile(uid);
  if (!profile?.householdId) {
    throw new Error('You are not in a group.');
  }

  const household = await getHousehold(profile.householdId);
  if (!household) {
    throw new Error('Group not found.');
  }

  const isMember = await isUserHouseholdMember(household.id, uid);
  if (!isMember) {
    throw new Error('You are not in this group.');
  }

  if (household.mode === targetMode) {
    return household;
  }

  if (household.mode !== 'partner') {
    throw new Error(`This group is already a ${householdModeLabel(household.mode)} group.`);
  }

  if (targetMode === 'family' && !canCreateFamilyHousehold(tier)) {
    throw new Error('Family sharing requires a Family subscription.');
  }

  if (targetMode === 'team' && !canCreateTeamHousehold(tier)) {
    throw new Error('Team sharing requires a Family subscription.');
  }

  const now = toISODate();
  const maxMembers = HOUSEHOLD_LIMITS[targetMode];
  const newName =
    household.name === defaultHouseholdName('partner')
      ? defaultHouseholdName(targetMode)
      : household.name;

  const batch = writeBatch(getFirebaseDb());
  batch.update(householdDocRef(household.id), {
    mode: targetMode,
    maxMembers,
    name: newName,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(householdInviteCodeDocRef(household.inviteCode), {
    mode: targetMode,
    maxMembers,
    name: newName,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  await batch.commit();

  return {
    ...household,
    mode: targetMode,
    maxMembers,
    name: newName,
    updatedAt: now,
  };
}

export async function joinHousehold(
  uid: string,
  email: string,
  inviteCode: string,
): Promise<Household> {
  const profile = await fetchUserProfile(uid);
  if (profile?.householdId) {
    throw new Error('Leave your current group before joining another.');
  }

  const household = await findHouseholdByInviteCode(inviteCode);
  if (!household) {
    throw new Error('Invite code not found. Check the code and try again.');
  }

  if (household.memberCount >= household.maxMembers) {
    throw new Error(`This group is full (${household.maxMembers} people max).`);
  }

  const now = toISODate();
  const nextMemberCount = household.memberCount + 1;

  const batch = writeBatch(getFirebaseDb());
  batch.set(householdMemberDocRef(household.id, uid), {
    email,
    role: 'member',
    joinedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(householdDocRef(household.id), {
    memberCount: nextMemberCount,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.update(householdInviteCodeDocRef(household.inviteCode), {
    memberCount: nextMemberCount,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
  batch.set(
    userDocRef(uid),
    {
      householdId: household.id,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return {
    ...household,
    memberCount: household.memberCount + 1,
    updatedAt: now,
  };
}

export async function leaveHousehold(uid: string): Promise<void> {
  const profile = await fetchUserProfile(uid);
  if (!profile?.householdId) {
    return;
  }

  const householdId = profile.householdId;
  const household = await getHousehold(householdId);
  const now = toISODate();

  if (household && household.memberCount > 1) {
    const nextMemberCount = household.memberCount - 1;
    await updateDoc(householdDocRef(householdId), {
      memberCount: nextMemberCount,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    });
    await syncInviteCodeMemberCount(household.inviteCode, nextMemberCount, now);
  }

  const batch = writeBatch(getFirebaseDb());
  batch.delete(householdMemberDocRef(householdId, uid));
  batch.set(
    userDocRef(uid),
    {
      householdId: null,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}

export { getSyncKey } from './firestoreSync';
