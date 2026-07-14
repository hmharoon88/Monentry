import { SubscriptionTier } from './categories';

/** Set `false` only for local dev/testing without sandbox purchases. */
export const PARTNER_REQUIRES_PLUS = true;
export const FAMILY_REQUIRES_SUBSCRIPTION = true;
export const SETTLE_REQUIRES_PLUS = true;

function hasPlusOrFamily(tier: SubscriptionTier): boolean {
  return tier === 'plus' || tier === 'family';
}

/** Creator needs Plus/Family. Joiners are free (same model as partner sharing). */
export function canCreatePartnerGroup(tier: SubscriptionTier): boolean {
  if (!PARTNER_REQUIRES_PLUS) {
    return true;
  }
  return hasPlusOrFamily(tier);
}

export function canCreateFamilyGroup(tier: SubscriptionTier): boolean {
  if (!FAMILY_REQUIRES_SUBSCRIPTION) {
    return true;
  }
  return tier === 'family';
}

/** Team groups are included with Family — same subscription gate. */
export function canCreateTeamGroup(tier: SubscriptionTier): boolean {
  return canCreateFamilyGroup(tier);
}

/** Creator needs Plus/Family. Joiners are free (same model as partner sharing). */
export function canCreateSettle(tier: SubscriptionTier): boolean {
  if (!SETTLE_REQUIRES_PLUS) {
    return true;
  }
  return hasPlusOrFamily(tier);
}
