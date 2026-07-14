export const EXPENSE_CATEGORIES = [
  'Grocery',
  'Dine out',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Leisure',
  'Other',
] as const;

/** Older entries may still use these labels in Summary / Today. */
export const LEGACY_EXPENSE_CATEGORIES = ['Food', 'Entertainment'] as const;

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
    appleTitle: 'Monentry Free',
    duration: '',
    description: 'Cloud backup when signed in · All your devices',
    price: '$0',
  },
  plus: {
    label: 'Plus',
    appleTitle: 'Monentry Plus',
    duration: '1 month (auto-renewing)',
    description: 'Family sharing up to 2 people · Settle invites · Join free with a code',
    price: '$1.99/mo',
  },
  family: {
    label: 'Family',
    appleTitle: 'Monentry Family',
    duration: '1 month (auto-renewing)',
    description: 'Everything in Plus · Family sharing up to 10 or 25 people',
    price: '$4.99/mo',
  },
} as const;
