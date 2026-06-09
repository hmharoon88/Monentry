export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Gift',
  'Refund',
  'Other',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'Card',
  'UPI',
  'Bank',
  'Wallet',
] as const;

export const PLACES = [
  'Home',
  'Office',
  'Store',
  'Online',
  'Travel',
] as const;

export type SubscriptionTier = 'free' | 'plus' | 'family';

export const SUBSCRIPTION_INFO = {
  free: {
    label: 'Free',
    description: 'Local only · 1 user · No cloud sync',
    price: '$0',
  },
  plus: {
    label: 'Plus',
    description: 'Cloud sync · Backup · All devices',
    price: '$1.99/mo',
  },
  family: {
    label: 'Family',
    description: 'Everything in Plus · Share with up to 6',
    price: '$4.99/mo',
  },
} as const;
