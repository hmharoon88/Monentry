import { SubscriptionTier } from '../constants/categories';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  tier: SubscriptionTier;
  householdId?: string | null;
  createdAt: string;
  updatedAt: string;
}
