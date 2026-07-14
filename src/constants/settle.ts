export const SETTLE_FEATURE = {
  name: 'Settle',
  tagline: 'Lend & borrow — 1-on-1 or with a group',
  description:
    'Track money between you and friends or family. Every entry needs someone else’s approval.',
} as const;

export { canCreateSettle, SETTLE_REQUIRES_PLUS } from './subscriptionAccess';
