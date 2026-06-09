import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
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
import {
  tierFromEntitlements,
} from '../constants/subscriptions';
import { getRevenueCatApiKey, isRevenueCatConfigured } from '../config/revenuecat';
import { isFirebaseConfigured } from '../config/firebase';
import { useAuth } from './AuthContext';
import { updateUserTier } from '../sync/firestoreSync';

interface SubscriptionContextValue {
  revenueCatReady: boolean;
  offeringsLoading: boolean;
  purchasing: boolean;
  offering: PurchasesOffering | null;
  plusPackage: PurchasesPackage | null;
  familyPackage: PurchasesPackage | null;
  purchasePlus: () => Promise<void>;
  purchaseFamily: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

async function syncTierFromCustomerInfo(
  uid: string,
  customerInfo: CustomerInfo,
  refreshProfile: () => Promise<void>,
): Promise<void> {
  const tier = tierFromEntitlements(customerInfo.entitlements.active);
  await updateUserTier(uid, tier);
  await refreshProfile();
}

function findPackage(
  offering: PurchasesOffering | null,
  identifiers: string[],
): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  for (const id of identifiers) {
    const match = offering.availablePackages.find(
      (pkg) => pkg.identifier === id || pkg.product.identifier === id,
    );
    if (match) {
      return match;
    }
  }

  return offering.availablePackages[0] ?? null;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, firebaseReady, refreshProfile } = useAuth();
  const revenueCatReady = isRevenueCatConfigured();
  const [offeringsLoading, setOfferingsLoading] = useState(revenueCatReady);
  const [purchasing, setPurchasing] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    if (!revenueCatReady) {
      setOfferingsLoading(false);
      return;
    }

    let cancelled = false;

    async function configurePurchases() {
      try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
        await Purchases.configure({ apiKey: getRevenueCatApiKey() });

        if (cancelled) {
          return;
        }

        const offerings = await Purchases.getOfferings();
        if (!cancelled) {
          setOffering(offerings.current);
        }
      } catch {
        if (!cancelled) {
          setOffering(null);
        }
      } finally {
        if (!cancelled) {
          setOfferingsLoading(false);
        }
      }
    }

    configurePurchases();

    return () => {
      cancelled = true;
    };
  }, [revenueCatReady]);

  useEffect(() => {
    if (!revenueCatReady || !user) {
      return;
    }

    const linkedUser = user;
    let cancelled = false;

    async function linkUser() {
      try {
        const result = await Purchases.logIn(linkedUser.uid);
        if (cancelled || !firebaseReady) {
          return;
        }

        await syncTierFromCustomerInfo(linkedUser.uid, result.customerInfo, refreshProfile);
      } catch {
        // Ignore RevenueCat link errors when offline or misconfigured.
      }
    }

    linkUser();

    return () => {
      cancelled = true;
    };
  }, [firebaseReady, refreshProfile, revenueCatReady, user]);

  useEffect(() => {
    if (!revenueCatReady) {
      return;
    }

    if (!user) {
      Purchases.logOut().catch(() => undefined);
    }
  }, [revenueCatReady, user]);

  const plusPackage = useMemo(
    () =>
      findPackage(offering, [
        'plus',
        '$rc_monthly',
        'monentry_plus_monthly',
      ]),
    [offering],
  );

  const familyPackage = useMemo(
    () =>
      findPackage(offering, [
        'family',
        'monentry_family_monthly',
      ]),
    [offering],
  );

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage | null, expectedTier: SubscriptionTier) => {
      if (!revenueCatReady) {
        throw new Error('Subscriptions are not configured yet.');
      }

      if (!user) {
        throw new Error('Sign in before subscribing.');
      }

      if (!pkg) {
        throw new Error('This plan is not available yet.');
      }

      if (!firebaseReady) {
        throw new Error('Cloud sync is not configured yet.');
      }

      setPurchasing(true);
      try {
        const result = await Purchases.purchasePackage(pkg);
        await syncTierFromCustomerInfo(user.uid, result.customerInfo, refreshProfile);

        const activeTier = tierFromEntitlements(result.customerInfo.entitlements.active);
        if (activeTier !== expectedTier && expectedTier === 'plus' && activeTier === 'free') {
          throw new Error('Purchase completed but Plus entitlement was not activated.');
        }
      } finally {
        setPurchasing(false);
      }
    },
    [firebaseReady, refreshProfile, revenueCatReady, user],
  );

  const purchasePlus = useCallback(async () => {
    await purchasePackage(plusPackage, 'plus');
  }, [plusPackage, purchasePackage]);

  const purchaseFamily = useCallback(async () => {
    await purchasePackage(familyPackage, 'family');
  }, [familyPackage, purchasePackage]);

  const restorePurchases = useCallback(async () => {
    if (!revenueCatReady) {
      throw new Error('Subscriptions are not configured yet.');
    }

    if (!user) {
      throw new Error('Sign in before restoring purchases.');
    }

    if (!firebaseReady) {
      throw new Error('Cloud sync is not configured yet.');
    }

    setPurchasing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      await syncTierFromCustomerInfo(user.uid, customerInfo, refreshProfile);
    } finally {
      setPurchasing(false);
    }
  }, [firebaseReady, refreshProfile, revenueCatReady, user]);

  const value = useMemo(
    () => ({
      revenueCatReady,
      offeringsLoading,
      purchasing,
      offering,
      plusPackage,
      familyPackage,
      purchasePlus,
      purchaseFamily,
      restorePurchases,
    }),
    [
      revenueCatReady,
      offeringsLoading,
      purchasing,
      offering,
      plusPackage,
      familyPackage,
      purchasePlus,
      purchaseFamily,
      restorePurchases,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
