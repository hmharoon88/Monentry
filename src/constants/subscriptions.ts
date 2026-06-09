import { SubscriptionTier } from './categories';

export const REVENUECAT_ENTITLEMENTS = {
  family: 'family',
  plus: 'plus',
} as const;

export const REVENUECAT_PRODUCT_IDS = {
  plus: 'monentry_plus_monthly',
  family: 'monentry_family_monthly',
} as const;

export function tierFromEntitlements(
  activeEntitlements: Record<string, unknown>,
): SubscriptionTier {
  if (activeEntitlements[REVENUECAT_ENTITLEMENTS.family]) {
    return 'family';
  }

  if (activeEntitlements[REVENUECAT_ENTITLEMENTS.plus]) {
    return 'plus';
  }

  return 'free';
}
