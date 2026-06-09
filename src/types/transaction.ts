export type EntryType = 'expense' | 'income';

export interface Transaction {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  method: string | null;
  place: string | null;
  who: string | null;
  note: string | null;
  date: string;
  createdAt: string;
}

export interface NewTransaction {
  type: EntryType;
  amount: number;
  category: string;
  method?: string;
  place?: string;
  who?: string;
  note?: string;
  date?: string;
}

export interface DayTotals {
  expense: number;
  income: number;
  net: number;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  type: EntryType;
}
