export type HouseholdMode = 'partner' | 'family' | 'team';

export interface Household {
  id: string;
  name: string;
  mode: HouseholdMode;
  ownerUid: string;
  inviteCode: string;
  maxMembers: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  uid: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export const HOUSEHOLD_LIMITS: Record<HouseholdMode, number> = {
  partner: 2,
  family: 10,
  team: 25,
};

export function householdModeLabel(mode: HouseholdMode): string {
  switch (mode) {
    case 'partner':
      return 'Partner';
    case 'family':
      return 'Family';
    case 'team':
      return 'Team';
  }
}

/** User-facing copy — branded as Family. */
export function familyGroupTitle(maxMembers: number): string {
  return `Family · up to ${maxMembers} people`;
}

export function familyGroupMemberLine(memberCount: number, maxMembers: number): string {
  return `${memberCount} of ${maxMembers} people`;
}

export function familyGroupSizeOption(maxMembers: number, note: string): string {
  return `Up to ${maxMembers} people · ${note}`;
}

export function defaultHouseholdName(mode: HouseholdMode): string {
  return householdModeLabel(mode);
}
