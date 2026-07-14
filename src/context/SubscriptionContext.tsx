import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { Linking, Platform } from 'react-native';
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
import { SubscriptionTier } from '../constants/categories';
import {
  FAMILY_PACKAGE_IDENTIFIERS,
  LEGACY_TEST_STORE_PRODUCT_IDS,
  PLUS_PACKAGE_IDENTIFIERS,
  REVENUECAT_OFFERING_ID,
  REVENUECAT_PRODUCT_IDS,
  purchaseActivationError,
  getSubscriptionSetupHint,
  resolveTierAfterPurchase,
  tierFromActiveSubscriptions,
  tierFromEntitlements,
} from '../constants/subscriptions';
import {
  configureRevenueCatLogging,
  getBillingBlockedReason,
  getRevenueCatApiKey,
  isTestStoreApiKey,
  shouldConfigureRevenueCat,
} from '../config/revenuecat';
import { isFirebaseConfigured } from '../config/firebase';
import { useAuth } from './AuthContext';
import { updateUserTier } from '../sync/firestoreSync';

interface SubscriptionContextValue {
  revenueCatReady: boolean;
  billingBlockedReason: string | null;
  billingError: string | null;
  offeringsLoading: boolean;
  offeringsAvailable: boolean;
  purchasing: boolean;
  offering: PurchasesOffering | null;
  plusPackage: PurchasesPackage | null;
  familyPackage: PurchasesPackage | null;
  plusPriceLabel: string | null;
  familyPriceLabel: string | null;
  purchasePlus: () => Promise<void>;
  purchaseFamily: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  manageSubscriptions: () => Promise<void>;
  refreshSubscriptionTier: () => Promise<SubscriptionTier>;
  canManageSubscriptions: boolean;
  usesTestStoreBilling: boolean;
  subscriptionSetupHint: string | null;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

async function syncTierFromCustomerInfo(
  uid: string,
  customerInfo: CustomerInfo,
  refreshProfile: () => Promise<void>,
): Promise<void> {
  let tier = tierFromEntitlements(customerInfo.entitlements.active);
  tier = tierFromActiveSubscriptions(customerInfo.activeSubscriptions, tier);
  await updateUserTier(uid, tier);
  await refreshProfile();
}

function resolveCurrentOffering(
  offerings: Awaited<ReturnType<typeof Purchases.getOfferings>> | null,
): PurchasesOffering | null {
  if (!offerings) {
    return null;
  }

  const all = offerings.all as Record<string, PurchasesOffering | undefined> | undefined;
  const preferred = all?.[REVENUECAT_OFFERING_ID];
  if (preferred) {
    return preferred;
  }

  if (offerings.current) {
    return offerings.current;
  }

  return all?.default ?? Object.values(all ?? {})[0] ?? null;
}

function findPackageByProductId(
  offering: PurchasesOffering | null,
  productId: string,
): PurchasesPackage | null {
  if (!offering) {
    return null;
  }
  const normalized = productId.toLowerCase();
  return (
    offering.availablePackages.find(
      (pkg) => pkg.product.identifier.toLowerCase() === normalized,
    ) ?? null
  );
}
function packageMatchesIdentifier(pkg: PurchasesPackage, id: string, exact: boolean): boolean {
  const normalized = id.toLowerCase();
  if (pkg.identifier === id || pkg.product.identifier === id) {
    return true;
  }
  if (exact) {
    return (
      pkg.identifier.toLowerCase() === normalized ||
      pkg.product.identifier.toLowerCase() === normalized
    );
  }
  return (
    pkg.identifier.toLowerCase().includes(normalized) ||
    pkg.product.identifier.toLowerCase().includes(normalized)
  );
}

function findPackage(
  offering: PurchasesOffering | null,
  identifiers: readonly string[],
  excludeIdentifiers: readonly string[] = [],
  rejectProductIds: readonly string[] = [],
): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  const rejectedProducts = new Set(rejectProductIds.map((id) => id.toLowerCase()));

  const packages = offering.availablePackages.filter((pkg) => {
    if (rejectedProducts.has(pkg.product.identifier.toLowerCase())) {
      return false;
    }
    if (
      excludeIdentifiers.length > 0 &&
      excludeIdentifiers.some((id) => packageMatchesIdentifier(pkg, id, false))
    ) {
      return false;
    }
    return true;
  });

  for (const id of identifiers) {
    const exactMatch = packages.find((pkg) => packageMatchesIdentifier(pkg, id, true));
    if (exactMatch) {
      return exactMatch;
    }
  }

  return null;
}

function logOfferingPackages(offering: PurchasesOffering | null): void {
  if (!__DEV__ || !offering) {
    return;
  }

  const summary = offering.availablePackages.map(
    (pkg) =>
      `${pkg.identifier} → ${pkg.product.identifier} (${pkg.product.priceString})`,
  );
  console.info('[Monentry] RevenueCat offering packages:', summary.join(', ') || '(none)');
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, firebaseReady, refreshProfile } = useAuth();
  const revenueCatReady = shouldConfigureRevenueCat();
  const billingBlockedReason = getBillingBlockedReason();
  const prevLinkedUserRef = useRef<typeof user>(undefined);
  const [offeringsLoading, setOfferingsLoading] = useState(revenueCatReady);
  const [billingError, setBillingError] = useState<string | null>(null);
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
        configureRevenueCatLogging();
        await Purchases.configure({ apiKey: getRevenueCatApiKey() });

        if (cancelled) {
          return;
        }

        const offerings = await Purchases.getOfferings();
        if (!cancelled) {
          const current = resolveCurrentOffering(offerings);
          setOffering(current);
          logOfferingPackages(current);
          if (__DEV__ && current && current.availablePackages.length === 0) {
            console.warn(
              `[Monentry] RevenueCat offering "${REVENUECAT_OFFERING_ID}" has no packages. Create it in dashboard or run: npm run configure-revenuecat`,
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setOffering(null);
          const message =
            error instanceof Error ? error.message : 'RevenueCat configuration failed';
          if (/invalid api key|credentials issue/i.test(message)) {
            setBillingError(
              'Invalid RevenueCat API key. Re-copy the iOS public key from RevenueCat → Project → API keys.',
            );
          } else if (/no App Store products|offerings-empty|offerings are empty/i.test(message)) {
            setBillingError(
              'App Store products are not on offering "monentry_plans" yet. In RevenueCat, attach monentry_plus_monthly and monentry_family_monthly (App Store) to packages.',
            );
          } else {
            setBillingError(message);
          }
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
    if (!revenueCatReady || !user || !firebaseReady) {
      return;
    }

    const linkedUser = user;
    let cancelled = false;

    async function linkUser() {
      try {
        const result = await Purchases.logIn(linkedUser.uid);
        if (cancelled) {
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
    if (!revenueCatReady || !user || !firebaseReady) {
      return;
    }

    const linkedUser = user;

    const listener = (customerInfo: CustomerInfo) => {
      syncTierFromCustomerInfo(linkedUser.uid, customerInfo, refreshProfile).catch(() => undefined);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [firebaseReady, refreshProfile, revenueCatReady, user]);

  useEffect(() => {
    if (!revenueCatReady) {
      return;
    }

    const hadLinkedUser = Boolean(prevLinkedUserRef.current);
    prevLinkedUserRef.current = user;

    if (!hadLinkedUser || user) {
      return;
    }

    void Purchases.isAnonymous()
      .then((isAnonymous) => {
        if (!isAnonymous) {
          return Purchases.logOut();
        }
      })
      .catch(() => undefined);
  }, [revenueCatReady, user]);

  const plusPackage = useMemo(() => {
    if (!offering) {
      return null;
    }
    return (
      findPackageByProductId(offering, REVENUECAT_PRODUCT_IDS.plusAppStore) ??
      findPackage(
        offering,
        [...PLUS_PACKAGE_IDENTIFIERS],
        [...FAMILY_PACKAGE_IDENTIFIERS],
        [...LEGACY_TEST_STORE_PRODUCT_IDS],
      )
    );
  }, [offering]);

  const familyPackage = useMemo(() => {
    if (!offering) {
      return null;
    }
    return (
      findPackageByProductId(offering, REVENUECAT_PRODUCT_IDS.family) ??
      findPackage(offering, [...FAMILY_PACKAGE_IDENTIFIERS], [], [...LEGACY_TEST_STORE_PRODUCT_IDS])
    );
  }, [offering]);

  const plusPriceLabel = plusPackage?.product.priceString ?? null;
  const familyPriceLabel = familyPackage?.product.priceString ?? null;
  const offeringsAvailable = Boolean(plusPackage || familyPackage);
  const subscriptionSetupHint = useMemo(
    () => getSubscriptionSetupHint(offering, plusPackage, familyPackage),
    [offering, plusPackage, familyPackage],
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
        const activeTier = resolveTierAfterPurchase(
          result.customerInfo.entitlements.active,
          expectedTier,
          result.customerInfo.activeSubscriptions,
        );
        const activationError = purchaseActivationError(expectedTier, activeTier);
        if (activationError) {
          throw new Error(activationError);
        }

        await updateUserTier(user.uid, activeTier);
        await refreshProfile();
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
      let tier = tierFromEntitlements(customerInfo.entitlements.active);
      tier = tierFromActiveSubscriptions(customerInfo.activeSubscriptions, tier);
      await updateUserTier(user.uid, tier);
      await refreshProfile();

      if (tier === 'free') {
        throw new Error('No active subscription found for this Apple ID.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [firebaseReady, refreshProfile, revenueCatReady, user]);

  const canManageSubscriptions =
    revenueCatReady && (Platform.OS === 'ios' || Platform.OS === 'android');
  const usesTestStoreBilling = isTestStoreApiKey();

  const refreshSubscriptionTier = useCallback(async (): Promise<SubscriptionTier> => {
    if (!revenueCatReady) {
      throw new Error('Subscriptions are not configured yet.');
    }

    if (!user) {
      throw new Error('Sign in before refreshing your plan.');
    }

    if (!firebaseReady) {
      throw new Error('Cloud sync is not configured yet.');
    }

    const customerInfo = await Purchases.getCustomerInfo();
    let tier = tierFromEntitlements(customerInfo.entitlements.active);
    tier = tierFromActiveSubscriptions(customerInfo.activeSubscriptions, tier);
    await updateUserTier(user.uid, tier);
    await refreshProfile();
    return tier;
  }, [firebaseReady, refreshProfile, revenueCatReady, user]);

  const manageSubscriptions = useCallback(async () => {
    if (!revenueCatReady) {
      throw new Error('Subscriptions are not configured yet.');
    }

    if (!user) {
      throw new Error('Sign in before managing your subscription.');
    }

    if (usesTestStoreBilling) {
      throw new Error('TEST_STORE_MANAGE');
    }

    if (Platform.OS === 'ios') {
      await Purchases.showManageSubscriptions();
    } else if (Platform.OS === 'android') {
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else {
      throw new Error('Manage subscription is not supported on this device.');
    }

    await refreshSubscriptionTier();
  }, [refreshSubscriptionTier, revenueCatReady, user, usesTestStoreBilling]);

  const value = useMemo(
    () => ({
      revenueCatReady,
      billingBlockedReason,
      billingError,
      offeringsLoading,
      offeringsAvailable,
      purchasing,
      offering,
      plusPackage,
      familyPackage,
      plusPriceLabel,
      familyPriceLabel,
      purchasePlus,
      purchaseFamily,
      restorePurchases,
      manageSubscriptions,
      refreshSubscriptionTier,
      canManageSubscriptions,
      usesTestStoreBilling,
      subscriptionSetupHint,
    }),
    [
      revenueCatReady,
      billingBlockedReason,
      billingError,
      offeringsLoading,
      offeringsAvailable,
      purchasing,
      offering,
      plusPackage,
      familyPackage,
      plusPriceLabel,
      familyPriceLabel,
      purchasePlus,
      purchaseFamily,
      restorePurchases,
      manageSubscriptions,
      refreshSubscriptionTier,
      canManageSubscriptions,
      usesTestStoreBilling,
      subscriptionSetupHint,
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
