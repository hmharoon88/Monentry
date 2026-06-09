import { CategoryTotal, DayTotals, NewTransaction, Transaction } from '../types/transaction';
import { endOfDay, isSameDay, startOfDay, startOfMonth, toISODate } from '../utils/date';
import { getDatabase } from './database';

const ACTIVE_FILTER = 'deletedAt IS NULL';

function rowToTransaction(row: Record<string, unknown>): Transaction {
  const createdAt = String(row.createdAt);
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
    createdAt,
    updatedAt: row.updatedAt ? String(row.updatedAt) : createdAt,
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
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
    updatedAt: now,
    deletedAt: null,
  };

  await database.runAsync(
    `INSERT INTO transactions (id, type, amount, category, method, place, who, note, date, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    transaction.updatedAt,
    transaction.deletedAt ?? null,
  );

  return transaction;
}

export async function upsertTransaction(transaction: Transaction): Promise<void> {
  const database = await getDatabase();

  await database.runAsync(
    `INSERT INTO transactions (id, type, amount, category, method, place, who, note, date, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       amount = excluded.amount,
       category = excluded.category,
       method = excluded.method,
       place = excluded.place,
       who = excluded.who,
       note = excluded.note,
       date = excluded.date,
       createdAt = excluded.createdAt,
       updatedAt = excluded.updatedAt,
       deletedAt = excluded.deletedAt`,
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
    transaction.updatedAt,
    transaction.deletedAt ?? null,
  );
}

export async function deleteTransaction(id: string): Promise<Transaction | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM transactions WHERE id = ?',
    id,
  );

  if (!row) {
    return null;
  }

  const deletedAt = toISODate();
  await database.runAsync(
    'UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE id = ?',
    deletedAt,
    deletedAt,
    id,
  );

  return {
    ...rowToTransaction(row),
    deletedAt,
    updatedAt: deletedAt,
  };
}

export async function clearAllTransactions(): Promise<Transaction[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions WHERE ${ACTIVE_FILTER}`,
  );
  const deletedAt = toISODate();

  await database.runAsync(
    `UPDATE transactions SET deletedAt = ?, updatedAt = ? WHERE ${ACTIVE_FILTER}`,
    deletedAt,
    deletedAt,
  );

  return rows.map((row) => ({
    ...rowToTransaction(row),
    deletedAt,
    updatedAt: deletedAt,
  }));
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions WHERE ${ACTIVE_FILTER} ORDER BY date DESC`,
  );
  return rows.map(rowToTransaction);
}

export async function getAllTransactionsForSync(): Promise<Transaction[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM transactions ORDER BY date DESC',
  );
  return rows.map(rowToTransaction);
}

export async function getTransactionsForDay(date = new Date()): Promise<Transaction[]> {
  const database = await getDatabase();
  const start = toISODate(startOfDay(date));
  const end = toISODate(endOfDay(date));
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions WHERE ${ACTIVE_FILTER} AND date >= ? AND date <= ? ORDER BY date DESC`,
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
    `SELECT * FROM transactions WHERE ${ACTIVE_FILTER} AND date >= ? AND date <= ? ORDER BY date DESC`,
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
