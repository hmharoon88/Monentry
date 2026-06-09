import { SubscriptionTier } from '../constants/categories';

export interface UserProfile {
  uid: string;
  email: string;
  tier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
}
