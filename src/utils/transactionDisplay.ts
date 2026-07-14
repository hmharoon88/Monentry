import { Transaction } from '../types/transaction';

/** Primary label: description (note) when provided, otherwise category. */
export function getTransactionTitle(transaction: Transaction): string {
  const note = transaction.note?.trim();
  if (note) {
    return note;
  }
  return transaction.category;
}

/** Show category under the title when the note is the main label and category adds context. */
export function shouldShowCategoryInMeta(transaction: Transaction): boolean {
  const note = transaction.note?.trim();
  if (!note) {
    return false;
  }
  return transaction.category.toLowerCase() !== 'other';
}
