import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

async function migrateDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
  const names = new Set(columns.map((column) => column.name));

  if (!names.has('updatedAt')) {
    await database.execAsync(`
      ALTER TABLE transactions ADD COLUMN updatedAt TEXT;
      UPDATE transactions SET updatedAt = createdAt WHERE updatedAt IS NULL;
    `);
  }

  if (!names.has('deletedAt')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN deletedAt TEXT;');
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync('monentry.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      method TEXT,
      place TEXT,
      who TEXT,
      note TEXT,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);

  await migrateDatabase(db);

  return db;
}
