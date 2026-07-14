export type SettleLedgerKind = 'pair' | 'group';

export const SETTLE_PAIR_MAX = 2;
export const SETTLE_GROUP_MAX = 10;

export type SettleLedgerStatus =
  | 'pending'
  | 'active'
  | 'declined'
  | 'cancelled'
  | 'closed'
  | 'close_pending';

export type SettleEntryStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'delete_pending'
  | 'deleted';

export interface SettleLedger {
  id: string;
  kind: SettleLedgerKind;
  maxMembers: number;
  participantIds: string[];
  participantEmails: Record<string, string>;
  inviteCode: string;
  status: SettleLedgerStatus;
  createdBy: string;
  label: string;
  closeRequestedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettleEntry {
  id: string;
  ledgerId: string;
  creditorUid: string;
  debtorUid: string;
  amount: number;
  note?: string;
  createdBy: string;
  status: SettleEntryStatus;
  deleteRequestedBy?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface SettleBalance {
  netCents: number;
  theyOweMeCents: number;
  iOweThemCents: number;
}
