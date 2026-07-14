import { SettleBalance, SettleEntry } from '../types/settle';

export function computeSettleBalance(
  entries: SettleEntry[],
  viewerUid: string,
  otherUid: string,
): SettleBalance {
  let theyOweMeCents = 0;
  let iOweThemCents = 0;

  for (const entry of entries) {
    if (entry.status !== 'approved') {
      continue;
    }

    const amountCents = Math.round(entry.amount * 100);
    if (entry.creditorUid === viewerUid && entry.debtorUid === otherUid) {
      theyOweMeCents += amountCents;
    } else if (entry.creditorUid === otherUid && entry.debtorUid === viewerUid) {
      iOweThemCents += amountCents;
    }
  }

  return {
    theyOweMeCents,
    iOweThemCents,
    netCents: theyOweMeCents - iOweThemCents,
  };
}

/** Net position in cents: positive = others owe this person, negative = they owe others. */
export function computeParticipantNetCents(entries: SettleEntry[], uid: string): number {
  let netCents = 0;

  for (const entry of entries) {
    if (entry.status !== 'approved') {
      continue;
    }

    const amountCents = Math.round(entry.amount * 100);
    if (entry.creditorUid === uid) {
      netCents += amountCents;
    }
    if (entry.debtorUid === uid) {
      netCents -= amountCents;
    }
  }

  return netCents;
}

export function computePairwiseNetCents(
  entries: SettleEntry[],
  viewerUid: string,
  otherUid: string,
): number {
  return computeSettleBalance(entries, viewerUid, otherUid).netCents;
}

export function computeAllNetPositions(
  entries: SettleEntry[],
  participantIds: string[],
): Record<string, number> {
  const positions: Record<string, number> = {};
  for (const uid of participantIds) {
    positions[uid] = computeParticipantNetCents(entries, uid);
  }
  return positions;
}

export function isGroupFullySettled(entries: SettleEntry[], participantIds: string[]): boolean {
  const positions = computeAllNetPositions(entries, participantIds);
  return participantIds.every((uid) => positions[uid] === 0);
}

export function formatPairwiseNet(netCents: number, otherName: string): string {
  const abs = Math.abs(netCents) / 100;
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (netCents > 0) {
    return `${otherName} owes you $${formatted}`;
  }
  if (netCents < 0) {
    return `You owe ${otherName} $${formatted}`;
  }
  return `Settled with ${otherName}`;
}

export function formatSettleBalance(netCents: number, otherName: string): string {
  const abs = Math.abs(netCents) / 100;
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (netCents > 0) {
    return `${otherName} owes you $${formatted}`;
  }
  if (netCents < 0) {
    return `You owe ${otherName} $${formatted}`;
  }
  return 'All settled up';
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
