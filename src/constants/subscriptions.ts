import { isTestStoreApiKey } from '../config/revenuecat';
import { SubscriptionTier } from './categories';

/** RevenueCat entitlement identifiers (Product catalog → Entitlements). */
export const REVENUECAT_ENTITLEMENTS = {
  /** Test Store + current dashboard setup */
  plus: 'Monentry Pro',
  /** Legacy / App Store Connect setup */
  plusLegacy: 'plus',
  family: 'family',
} as const;

/** Primary offering — create in RevenueCat and mark Current (replaces messy default). */
export const REVENUECAT_OFFERING_ID = 'monentry_plans';

/** RevenueCat product / package identifiers to match in offerings. */
export const REVENUECAT_PRODUCT_IDS = {
  plusMonthly: 'monthly',
  plusYearly: 'yearly',
  plusLifetime: 'lifetime',
  plusAppStore: 'monentry_plus_monthly',
  family: 'monentry_family_monthly',
} as const;

const PLUS_ENTITLEMENT_KEYS = [
  REVENUECAT_ENTITLEMENTS.plus,
  REVENUECAT_ENTITLEMENTS.plusLegacy,
] as const;

/** Match RevenueCat dashboard + Test Store naming variants. */
const FAMILY_ENTITLEMENT_KEYS = [
  REVENUECAT_ENTITLEMENTS.family,
  'Monentry Family',
  'family',
] as const;

export function tierFromEntitlements(
  activeEntitlements: Record<string, unknown>,
): SubscriptionTier {
  for (const key of FAMILY_ENTITLEMENT_KEYS) {
    if (activeEntitlements[key]) {
      return 'family';
    }
  }

  for (const key of PLUS_ENTITLEMENT_KEYS) {
    if (activeEntitlements[key]) {
      return 'plus';
    }
  }

  return 'free';
}

/**
 * Map a completed purchase to the app tier.
 * Production: trust RevenueCat entitlements only.
 * Test Store: may grant only "Monentry Pro" — trust expectedTier as fallback.
 */
export function resolveTierAfterPurchase(
  activeEntitlements: Record<string, unknown>,
  expectedTier: SubscriptionTier,
  activeSubscriptions: string[] = [],
): SubscriptionTier {
  let tier = tierFromEntitlements(activeEntitlements);
  tier = tierFromActiveSubscriptions(activeSubscriptions, tier);

  if (tier === 'family' || tier === 'plus') {
    return tier;
  }

  if (isTestStoreApiKey() && (expectedTier === 'family' || expectedTier === 'plus')) {
    return expectedTier;
  }

  return 'free';
}

export function purchaseActivationError(
  expectedTier: SubscriptionTier,
  activeTier: SubscriptionTier,
): string | null {
  if (expectedTier === 'plus' && activeTier === 'free') {
    return 'Purchase completed but Plus entitlement was not activated. In RevenueCat, link the Plus product to a plus entitlement.';
  }

  if (expectedTier === 'family' && activeTier !== 'family') {
    const active =
      activeTier === 'plus'
        ? 'Plus only — Family product may be mapped to the wrong entitlement.'
        : 'No active entitlement.';
    return `Purchase completed but Family was not activated. ${active} In RevenueCat, link monentry_family_monthly to a family entitlement.`;
  }

  return null;
}

export function tierFromActiveSubscriptions(
  activeSubscriptions: string[],
  fallback: SubscriptionTier,
): SubscriptionTier {
  if (activeSubscriptions.some((id) => /family/i.test(id))) {
    return 'family';
  }
  return fallback;
}

/** Default Test Store template products — usually $9.99/mo; ignore once real products exist. */
export const LEGACY_TEST_STORE_PRODUCT_IDS = [
  REVENUECAT_PRODUCT_IDS.plusMonthly,
  REVENUECAT_PRODUCT_IDS.plusYearly,
  REVENUECAT_PRODUCT_IDS.plusLifetime,
] as const;

/** Match package or product IDs — never fuzzy-match legacy Test Store product names. */
export const PLUS_PACKAGE_IDENTIFIERS = [
  REVENUECAT_PRODUCT_IDS.plusAppStore,
  'plus',
  '$rc_monthly',
] as const;

export const FAMILY_PACKAGE_IDENTIFIERS = [
  REVENUECAT_PRODUCT_IDS.family,
  'family',
  'Monentry Family',
  '$rc_custom',
] as const;

export function getSubscriptionSetupHint(
  offering: { availablePackages: { identifier: string; product: { identifier: string } }[] } | null,
  plusPackage: unknown,
  familyPackage: unknown,
): string | null {
  if (plusPackage && familyPackage) {
    return null;
  }

  if (!offering) {
    return 'Wire App Store products on offering "monentry_plans" in RevenueCat (plus + family packages).';
  }

  const packages = offering.availablePackages;
  if (packages.length === 0) {
    return `RevenueCat offering "${REVENUECAT_OFFERING_ID}" has no packages. Create it in dashboard and mark Current.`;
  }

  const onlyLegacy = packages.every((pkg) =>
    (LEGACY_TEST_STORE_PRODUCT_IDS as readonly string[]).includes(pkg.product.identifier),
  );
  if (onlyLegacy) {
    return `Offering only has legacy monthly ($9.99). Add monentry_plus_monthly and monentry_family_monthly to "${REVENUECAT_OFFERING_ID}".`;
  }

  if (!plusPackage) {
    return `Plus needs monentry_plus_monthly on offering "${REVENUECAT_OFFERING_ID}".`;
  }

  if (!familyPackage) {
    return `Family needs monentry_family_monthly on offering "${REVENUECAT_OFFERING_ID}".`;
  }

  return null;
}
