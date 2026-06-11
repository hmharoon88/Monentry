import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
  useState,
} from 'react';
import { SubscriptionTier } from '../constants/categories';
import { getFirebaseAuth, isFirebaseConfigured } from '../config/firebase';
import { signInWithApple, signInWithGoogleIdToken } from '../auth/socialAuth';
import {
  canSyncForAccount,
  ensureUserProfile,
  fetchUserProfile,
  fullSync,
  subscribeToRemoteTransactions,
} from '../sync/firestoreSync';
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const firebaseReady = isFirebaseConfigured();

  const tier: SubscriptionTier = profile?.tier ?? 'free';
  const syncEnabled = canSyncForAccount(firebaseReady, Boolean(user));
  const canSync = syncEnabled;

  const runFullSync = useCallback(async (uid: string) => {
    setSyncing(true);
    try {
      await fullSync(uid);
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

    await runFullSync(user.uid);
  }, [firebaseReady, runFullSync, user]);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return;
    }

    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }

      await loadProfile(nextUser);
      await runFullSync(nextUser.uid);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, [firebaseReady, loadProfile, runFullSync]);

  useEffect(() => {
    if (!user || !canSyncForAccount(firebaseReady, true)) {
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeToRemoteTransactions(user.uid, async () => {
      if (cancelled) {
        return;
      }

      setSyncing(true);
      try {
        await fullSync(user.uid);
        if (!cancelled) {
          setLastSyncedAt(Date.now());
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseReady, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    await ensureUserProfile(credential.user.uid, credential.user.email ?? email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    setProfile(null);
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
      signIn,
      signUp,
      signOut,
      resetPassword,
      signInWithApple: handleAppleSignIn,
      signInWithGoogleIdToken: handleGoogleSignIn,
      triggerSync,
      refreshProfile,
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
      signIn,
      signUp,
      signOut,
      resetPassword,
      handleAppleSignIn,
      handleGoogleSignIn,
      triggerSync,
      refreshProfile,
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
