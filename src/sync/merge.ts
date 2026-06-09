import { Transaction } from '../types/transaction';

export function pickNewerTransaction(local: Transaction, remote: Transaction): Transaction {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);

  if (remoteTime > localTime) {
    return remote;
  }

  if (localTime > remoteTime) {
    return local;
  }

  return remote;
}

export function mergeTransactionLists(
  local: Transaction[],
  remote: Transaction[],
): Transaction[] {
  const map = new Map<string, Transaction>();

  for (const tx of local) {
    map.set(tx.id, tx);
  }

  for (const remoteTx of remote) {
    const existing = map.get(remoteTx.id);
    map.set(remoteTx.id, existing ? pickNewerTransaction(existing, remoteTx) : remoteTx);
  }

  return Array.from(map.values());
}
