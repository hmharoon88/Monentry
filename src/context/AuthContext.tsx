import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionTier } from '../constants/categories';
import { getFirebaseAuth, isFirebaseConfigured } from '../config/firebase';
import { signInWithApple, signInWithGoogleIdToken } from '../auth/socialAuth';
import {
  canSyncForAccount,
  ensureUserProfile,
  fetchUserProfile,
  fullSync,
  getSyncKey,
  mergeRemoteIntoLocal,
  resetLocalFromRemote,
  subscribeToRemoteTransactions,
} from '../sync/firestoreSync';
import { wipeLocalTransactions } from '../storage/transactions';
import { deleteUserAccount } from '../sync/deleteAccount';
import { isUserHouseholdMember } from '../sync/householdSync';
import { UserProfile } from '../types/user';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  tier: SubscriptionTier;
  canSync: boolean;
  syncEnabled: boolean;
  syncing: boolean;
  lastSyncedAt: number;
  authLoading: boolean;
  firebaseReady: boolean;
  householdId: string | null;
  syncKey: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LAST_SYNC_UID_KEY = 'monentry:lastSyncUid';

async function getLastSyncUid(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_UID_KEY);
}

async function setLastSyncUid(uid: string | null): Promise<void> {
  if (uid) {
    await AsyncStorage.setItem(LAST_SYNC_UID_KEY, uid);
    return;
  }
  await AsyncStorage.removeItem(LAST_SYNC_UID_KEY);
}

function usesEmailPasswordProvider(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === 'password');
}

async function reloadEmailVerified(user: User): Promise<boolean> {
  await user.reload();
  return user.emailVerified;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const remoteSyncInFlight = useRef(false);
  const allowUnverifiedSessionRef = useRef(false);
  const firebaseReady = isFirebaseConfigured();

  const tier: SubscriptionTier = profile?.tier ?? 'free';
  const householdId = profile?.householdId ?? null;
  const syncKey = user ? getSyncKey(user.uid, householdId) : '';
  const syncEnabled = canSyncForAccount(firebaseReady, Boolean(user));
  const canSync = syncEnabled;

  const runFullSync = useCallback(async (uid: string, key: string) => {
    setSyncing(true);
    try {
      await fullSync(uid, key);
      setLastSyncedAt(Date.now());
    } finally {
      setSyncing(false);
    }
  }, []);

  const loadProfile = useCallback(async (nextUser: User) => {
    let nextProfile = await fetchUserProfile(nextUser.uid);

    if (!nextProfile) {
      nextProfile = await ensureUserProfile(nextUser.uid, nextUser.email ?? '');
    }

    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    await loadProfile(user);
  }, [loadProfile, user]);

  const triggerSync = useCallback(async () => {
    if (!user || !canSyncForAccount(firebaseReady, true)) {
      return;
    }

    await runFullSync(user.uid, syncKey);
  }, [firebaseReady, runFullSync, syncKey, user]);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return;
    }

    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        await wipeLocalTransactions();
        await setLastSyncUid(null);
        setProfile(null);
        setLastSyncedAt(Date.now());
        setAuthLoading(false);
        return;
      }

      const emailVerified = await reloadEmailVerified(nextUser);
      const needsEmailVerification =
        usesEmailPasswordProvider(nextUser) && !emailVerified;

      if (needsEmailVerification && !allowUnverifiedSessionRef.current) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setLastSyncedAt(Date.now());
        setAuthLoading(false);
        return;
      }

      if (needsEmailVerification && allowUnverifiedSessionRef.current) {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);
        return;
      }

      setUser(nextUser);

      const prof = await loadProfile(nextUser);
      const key = getSyncKey(nextUser.uid, prof.householdId);
      const lastSyncUid = await getLastSyncUid();

      if (lastSyncUid && lastSyncUid !== nextUser.uid) {
        await resetLocalFromRemote(nextUser.uid, key);
      } else {
        await runFullSync(nextUser.uid, key);
      }

      await setLastSyncUid(nextUser.uid);
      setLastSyncedAt(Date.now());
      setAuthLoading(false);
    });

    return unsubscribe;
  }, [firebaseReady, loadProfile, runFullSync]);

  useEffect(() => {
    if (!user || !canSyncForAccount(firebaseReady, true)) {
      return;
    }

    const linkedUser = user;
    const key = getSyncKey(linkedUser.uid, householdId);
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    async function pullRemoteChanges() {
      if (cancelled || remoteSyncInFlight.current) {
        return;
      }

      remoteSyncInFlight.current = true;
      setSyncing(true);
      try {
        await mergeRemoteIntoLocal(linkedUser.uid, key);
        if (!cancelled) {
          setLastSyncedAt(Date.now());
        }
      } finally {
        remoteSyncInFlight.current = false;
        if (!cancelled) {
          setSyncing(false);
        }
      }
    }

    async function attachListener() {
      if (householdId) {
        const isMember = await isUserHouseholdMember(householdId, linkedUser.uid);
        if (!isMember || cancelled) {
          return;
        }
      }

      unsubscribe = subscribeToRemoteTransactions(
        linkedUser.uid,
        key,
        () => {
          if (cancelled) {
            return;
          }

          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            pullRemoteChanges();
          }, 1000);
        },
        () => {
          // Ignore permission races while membership is still propagating.
        },
      );
    }

    attachListener();

    return () => {
      cancelled = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribe?.();
    };
  }, [firebaseReady, householdId, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    const emailVerified = await reloadEmailVerified(credential.user);

    if (usesEmailPasswordProvider(credential.user) && !emailVerified) {
      await firebaseSignOut(getFirebaseAuth());
      throw new Error(
        'Confirm your email first. Check your inbox for the verification link, then sign in again.',
      );
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    allowUnverifiedSessionRef.current = true;
    const auth = getFirebaseAuth();

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserProfile(credential.user.uid, credential.user.email ?? email.trim());
      await sendEmailVerification(credential.user);
    } finally {
      allowUnverifiedSessionRef.current = false;
      await firebaseSignOut(auth);
      await wipeLocalTransactions();
      await setLastSyncUid(null);
      setUser(null);
      setProfile(null);
      setLastSyncedAt(Date.now());
    }
  }, []);

  const resendVerificationEmail = useCallback(async (email: string, password: string) => {
    allowUnverifiedSessionRef.current = true;
    const auth = getFirebaseAuth();

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const emailVerified = await reloadEmailVerified(credential.user);

      if (emailVerified) {
        throw new Error('This email is already verified. You can sign in.');
      }

      await sendEmailVerification(credential.user);
    } finally {
      allowUnverifiedSessionRef.current = false;
      await firebaseSignOut(auth);
    }
  }, []);

  const signOut = useCallback(async () => {
    await wipeLocalTransactions();
    await setLastSyncUid(null);
    await firebaseSignOut(getFirebaseAuth());
    setProfile(null);
    setLastSyncedAt(Date.now());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    await signInWithApple();
  }, []);

  const handleGoogleSignIn = useCallback(async (idToken: string) => {
    await signInWithGoogleIdToken(idToken);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) {
      throw new Error('Sign in to delete your account.');
    }
    await deleteUserAccount(user.uid);
    await wipeLocalTransactions();
    await setLastSyncUid(null);
    setProfile(null);
    setLastSyncedAt(Date.now());
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      tier,
      canSync,
      syncEnabled,
      syncing,
      lastSyncedAt,
      authLoading,
      firebaseReady,
      householdId,
      syncKey,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendVerificationEmail,
      signInWithApple: handleAppleSignIn,
      signInWithGoogleIdToken: handleGoogleSignIn,
      triggerSync,
      refreshProfile,
      deleteAccount,
    }),
    [
      user,
      profile,
      tier,
      canSync,
      syncEnabled,
      syncing,
      lastSyncedAt,
      authLoading,
      firebaseReady,
      householdId,
      syncKey,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendVerificationEmail,
      handleAppleSignIn,
      handleGoogleSignIn,
      triggerSync,
      refreshProfile,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
