import { SettleLedger } from '../types/settle';

export function isGroupLedger(ledger: SettleLedger): boolean {
  return ledger.kind === 'group';
}

export function otherParticipantId(ledger: SettleLedger, uid: string): string | null {
  if (isGroupLedger(ledger)) {
    return null;
  }
  return ledger.participantIds.find((id) => id !== uid) ?? null;
}

export function participantEmailName(ledger: SettleLedger, uid: string): string {
  const email = ledger.participantEmails[uid];
  if (email) {
    return email.split('@')[0];
  }
  return 'Member';
}

export function ledgerDisplayName(ledger: SettleLedger, uid: string): string {
  if (isGroupLedger(ledger)) {
    const count = ledger.participantIds.length;
    return `${ledger.label} · ${count} ${count === 1 ? 'person' : 'people'}`;
  }

  const otherId = otherParticipantId(ledger, uid);
  if (otherId && ledger.participantEmails[otherId]) {
    return ledger.participantEmails[otherId].split('@')[0];
  }
  if (ledger.status === 'pending' && ledger.createdBy === uid) {
    return ledger.label;
  }
  return 'Settle';
}

export function ledgerSubtitle(ledger: SettleLedger): string | null {
  if (!isGroupLedger(ledger)) {
    return null;
  }
  if (ledger.participantIds.length < ledger.maxMembers) {
    return `${ledger.participantIds.length} of ${ledger.maxMembers} people · share invite to add more`;
  }
  return `${ledger.maxMembers} people`;
}
