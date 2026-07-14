import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Household, HouseholdMember } from '../types/household';
import { useAuth } from './AuthContext';
import {
  createHousehold,
  getHousehold,
  getHouseholdMembers,
  joinHousehold,
  leaveHousehold,
  upgradeHouseholdMode,
} from '../sync/householdSync';
import { fetchUserProfile, fullSync, getSyncKey } from '../sync/firestoreSync';

interface HouseholdContextValue {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  createPartnerGroup: () => Promise<Household>;
  createFamilyGroup: () => Promise<Household>;
  createTeamGroup: () => Promise<Household>;
  joinWithCode: (code: string) => Promise<Household>;
  leaveGroup: () => Promise<void>;
  upgradeGroupToFamily: () => Promise<Household>;
  refreshHousehold: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, tier, householdId, refreshProfile } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHouseholdById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [nextHousehold, nextMembers] = await Promise.all([
        getHousehold(id),
        getHouseholdMembers(id),
      ]);
      setHousehold(nextHousehold);
      setMembers(nextMembers);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHousehold = useCallback(async () => {
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      return;
    }

    await loadHouseholdById(householdId);
  }, [householdId, loadHouseholdById]);

  useEffect(() => {
    refreshHousehold();
  }, [refreshHousehold]);

  const afterHouseholdChange = useCallback(
    async (knownHouseholdId?: string | null) => {
      if (!user) {
        return;
      }

      await refreshProfile();
      const profile = await fetchUserProfile(user.uid);
      const nextHouseholdId = knownHouseholdId ?? profile?.householdId ?? null;

      if (nextHouseholdId) {
        const key = getSyncKey(user.uid, nextHouseholdId);
        try {
          await fullSync(user.uid, key);
        } catch {
          // Join/create succeeded; sync can retry once membership is active.
        }
        await loadHouseholdById(nextHouseholdId);
        return;
      }

      setHousehold(null);
      setMembers([]);
    },
    [loadHouseholdById, refreshProfile, user],
  );

  const createPartnerGroup = useCallback(async () => {
    if (!user?.email) {
      throw new Error('Sign in to create a partner group.');
    }
    const created = await createHousehold(user.uid, user.email, 'partner', tier);
    await afterHouseholdChange(created.id);
    return created;
  }, [afterHouseholdChange, tier, user]);

  const createFamilyGroup = useCallback(async () => {
    if (!user?.email) {
      throw new Error('Sign in to create a family group.');
    }
    const created = await createHousehold(user.uid, user.email, 'family', tier);
    await afterHouseholdChange(created.id);
    return created;
  }, [afterHouseholdChange, tier, user]);

  const createTeamGroup = useCallback(async () => {
    if (!user?.email) {
      throw new Error('Sign in to create a team group.');
    }
    const created = await createHousehold(user.uid, user.email, 'team', tier);
    await afterHouseholdChange(created.id);
    return created;
  }, [afterHouseholdChange, tier, user]);

  const joinWithCode = useCallback(
    async (code: string) => {
      if (!user?.email) {
        throw new Error('Sign in to join a group.');
      }
      const joined = await joinHousehold(user.uid, user.email, code);
      await afterHouseholdChange(joined.id);
      return joined;
    },
    [afterHouseholdChange, user],
  );

  const leaveGroup = useCallback(async () => {
    if (!user) {
      return;
    }
    await leaveHousehold(user.uid);
    await afterHouseholdChange();
  }, [afterHouseholdChange, user]);

  const upgradeGroupToFamily = useCallback(async () => {
    if (!user) {
      throw new Error('Sign in to upgrade your group.');
    }
    const upgraded = await upgradeHouseholdMode(user.uid, tier, 'family');
    await loadHouseholdById(upgraded.id);
    return upgraded;
  }, [loadHouseholdById, tier, user]);

  const value = useMemo(
    () => ({
      household,
      members,
      loading,
      createPartnerGroup,
      createFamilyGroup,
      createTeamGroup,
      joinWithCode,
      leaveGroup,
      upgradeGroupToFamily,
      refreshHousehold,
    }),
    [
      household,
      members,
      loading,
      createPartnerGroup,
      createFamilyGroup,
      createTeamGroup,
      joinWithCode,
      leaveGroup,
      upgradeGroupToFamily,
      refreshHousehold,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider');
  }
  return context;
}
