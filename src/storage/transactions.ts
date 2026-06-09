import { CategoryTotal, DayTotals, NewTransaction, Transaction } from '../types/transaction';
import { endOfDay, isSameDay, startOfDay, startOfMonth, toISODate } from '../utils/date';
import { getDatabase } from './database';

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    type: row.type as Transaction['type'],
    amount: Number(row.amount),
    category: String(row.category),
    method: row.method ? String(row.method) : null,
    place: row.place ? String(row.place) : null,
    who: row.who ? String(row.who) : null,
    note: row.note ? String(row.note) : null,
    date: String(row.date),
    createdAt: String(row.createdAt),
  };
}

export async function addTransaction(input: NewTransaction): Promise<Transaction> {
  const database = await getDatabase();
  const now = toISODate();
  const transaction: Transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: input.type,
    amount: input.amount,
    category: input.category,
    method: input.method ?? null,
    place: input.place ?? null,
    who: input.who ?? null,
    note: input.note ?? null,
    date: input.date ?? now,
    createdAt: now,
  };

  await database.runAsync(
    `INSERT INTO transactions (id, type, amount, category, method, place, who, note, date, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    transaction.id,
    transaction.type,
    transaction.amount,
    transaction.category,
    transaction.method,
    transaction.place,
    transaction.who,
    transaction.note,
    transaction.date,
    transaction.createdAt,
  );

  return transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function clearAllTransactions(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM transactions');
}

export async function getTransactionsForDay(date = new Date()): Promise<Transaction[]> {
  const database = await getDatabase();
  const start = toISODate(startOfDay(date));
  const end = toISODate(endOfDay(date));
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC',
    start,
    end,
  );
  return rows.map(rowToTransaction);
}

export async function getTransactionsForMonth(date = new Date()): Promise<Transaction[]> {
  const database = await getDatabase();
  const start = toISODate(startOfMonth(date));
  const end = toISODate(endOfDay(date));
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC',
    start,
    end,
  );
  return rows.map(rowToTransaction);
}

export function calculateDayTotals(transactions: Transaction[]): DayTotals {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'expense') {
        acc.expense += tx.amount;
        acc.net -= tx.amount;
      } else {
        acc.income += tx.amount;
        acc.net += tx.amount;
      }
      return acc;
    },
    { expense: 0, income: 0, net: 0 },
  );
}

export function groupByCategory(transactions: Transaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();

  for (const tx of transactions) {
    const key = `${tx.type}:${tx.category}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount += tx.amount;
    } else {
      map.set(key, { category: tx.category, amount: tx.amount, type: tx.type });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export function filterToday(transactions: Transaction[]): Transaction[] {
  const today = toISODate();
  return transactions.filter((tx) => isSameDay(tx.date, today));
}
