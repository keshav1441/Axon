import { randomUUID } from 'expo-crypto';

import { getDb } from './client';
import type { Category } from '@/features/money/categories';
import { guessCategory } from '@/features/money/categories';
import type { ParsedTransaction } from '@/features/money/parser';

export type TransactionRow = {
  id: string;
  amount: number;
  direction: 'debit' | 'credit';
  merchant: string | null;
  category: string | null;
  account_tail: string | null;
  source: 'sms' | 'notification';
  occurred_at: number;
  dedupe_key: string;
  created_at: number;
};

export async function getCategoryRules(): Promise<Record<string, Category>> {
  const db = await getDb();
  const { rows } = await db.execute('SELECT keyword, category FROM category_rules');
  const rules: Record<string, Category> = {};
  for (const row of rows) {
    rules[String(row.keyword)] = row.category as Category;
  }
  return rules;
}

/** Inserts a parsed transaction if it's not a duplicate. Returns the inserted row, or null if it was a dupe. */
export async function insertParsedTransaction(
  parsed: ParsedTransaction,
): Promise<TransactionRow | null> {
  const db = await getDb();
  const rules = await getCategoryRules();
  const category = guessCategory(parsed.merchant, rules);
  const id = randomUUID();
  const createdAt = Date.now();

  const result = await db.execute(
    `INSERT OR IGNORE INTO transactions
      (id, amount, direction, merchant, category, account_tail, source, occurred_at, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.amount,
      parsed.direction,
      parsed.merchant,
      category,
      parsed.accountTail,
      parsed.source,
      parsed.occurredAt,
      parsed.dedupeKey,
      createdAt,
    ],
  );

  if (result.rowsAffected === 0) return null;

  return {
    id,
    amount: parsed.amount,
    direction: parsed.direction,
    merchant: parsed.merchant,
    category,
    account_tail: parsed.accountTail,
    source: parsed.source,
    occurred_at: parsed.occurredAt,
    dedupe_key: parsed.dedupeKey,
    created_at: createdAt,
  };
}

export async function listTransactions(limit = 200): Promise<TransactionRow[]> {
  const db = await getDb();
  const { rows } = await db.execute(
    'SELECT * FROM transactions ORDER BY occurred_at DESC LIMIT ?',
    [limit],
  );
  return rows as unknown as TransactionRow[];
}

/** Updates the category and remembers the merchant keyword so future transactions auto-tag the same way. */
export async function updateTransactionCategory(id: string, category: Category): Promise<void> {
  const db = await getDb();
  const { rows } = await db.execute('SELECT merchant FROM transactions WHERE id = ?', [id]);
  const merchant = rows[0]?.merchant as string | undefined;

  await db.execute('UPDATE transactions SET category = ? WHERE id = ?', [category, id]);

  if (merchant) {
    const keyword = merchant.toLowerCase().split(/\s+/)[0];
    if (keyword && keyword.length >= 3) {
      await db.execute(
        'INSERT INTO category_rules (keyword, category) VALUES (?, ?) ON CONFLICT (keyword) DO UPDATE SET category = excluded.category',
        [keyword, category],
      );
    }
  }
}

export type MonthSummary = {
  totalSpend: number;
  totalIncome: number;
  byCategory: { category: string; total: number }[];
};

export async function getMonthSummary(monthStartMs: number, monthEndMs: number): Promise<MonthSummary> {
  const db = await getDb();

  const totals = await db.execute(
    `SELECT direction, SUM(amount) as total FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? GROUP BY direction`,
    [monthStartMs, monthEndMs],
  );
  let totalSpend = 0;
  let totalIncome = 0;
  for (const row of totals.rows) {
    if (row.direction === 'debit') totalSpend = Number(row.total) || 0;
    if (row.direction === 'credit') totalIncome = Number(row.total) || 0;
  }

  const byCategoryResult = await db.execute(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? AND direction = 'debit'
     GROUP BY category ORDER BY total DESC`,
    [monthStartMs, monthEndMs],
  );
  const byCategory = byCategoryResult.rows.map((row) => ({
    category: String(row.category ?? 'Uncategorized'),
    total: Number(row.total) || 0,
  }));

  return { totalSpend, totalIncome, byCategory };
}

export type SubscriptionGuess = {
  merchant: string;
  amount: number;
  lastOccurredAt: number;
  estimatedNextDate: number;
  occurrences: number;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECURRING_TOLERANCE_MS = 6 * 24 * 60 * 60 * 1000;

/** Heuristic: same merchant + same amount, at least twice, roughly a month apart. */
export function detectSubscriptions(transactions: TransactionRow[]): SubscriptionGuess[] {
  const groups = new Map<string, TransactionRow[]>();
  for (const tx of transactions) {
    if (tx.direction !== 'debit' || !tx.merchant) continue;
    const key = `${tx.merchant.toLowerCase()}:${tx.amount}`;
    const group = groups.get(key) ?? [];
    group.push(tx);
    groups.set(key, group);
  }

  const guesses: SubscriptionGuess[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.occurred_at - b.occurred_at);
    const gaps = group.slice(1).map((tx, i) => tx.occurred_at - group[i].occurred_at);
    const looksMonthly = gaps.every((gap) => Math.abs(gap - THIRTY_DAYS_MS) < RECURRING_TOLERANCE_MS);
    if (!looksMonthly) continue;

    const last = group[group.length - 1];
    guesses.push({
      merchant: last.merchant!,
      amount: last.amount,
      lastOccurredAt: last.occurred_at,
      estimatedNextDate: last.occurred_at + THIRTY_DAYS_MS,
      occurrences: group.length,
    });
  }
  return guesses;
}
