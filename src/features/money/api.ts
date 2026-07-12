import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import { enqueuePendingWrite, flushPendingWrites } from '@/api/pending-writes';
import type { Category } from '@/features/money/categories';
import type { ParsedTransaction } from '@/features/money/parser';

export type TransactionRow = {
  id: string;
  bankAccountId: string | null;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string | null;
  category: string | null;
  accountTail: string | null;
  source: 'sms' | 'notif' | 'manual';
  occurredAt: string;
  dedupRef: string;
  createdAt: string;
};

function toCreateBody(parsed: ParsedTransaction) {
  return {
    amount: parsed.amount.toFixed(2),
    direction: parsed.direction,
    merchant: parsed.merchant ?? undefined,
    accountTail: parsed.accountTail ?? undefined,
    bankName: parsed.bankName ?? undefined,
    source: parsed.source === 'notification' ? 'notif' : 'sms',
    occurredAt: new Date(parsed.occurredAt).toISOString(),
    dedupRef: parsed.dedupeKey,
  };
}

/** POSTs the parsed transaction; on network failure, queues it for retry instead of losing it. */
export async function submitParsedTransaction(parsed: ParsedTransaction): Promise<void> {
  const body = toCreateBody(parsed);
  try {
    await apiPost('/api/money', body);
  } catch {
    await enqueuePendingWrite('/api/money', body);
  }
}

export async function flushPendingTransactions(): Promise<void> {
  await flushPendingWrites((path, body) => apiPost(path, body));
}

export async function listTransactions(): Promise<TransactionRow[]> {
  const res = await apiGet<{ transactions: TransactionRow[] }>('/api/money');
  return res.transactions;
}

export async function updateTransactionCategory(id: string, category: Category): Promise<TransactionRow> {
  return apiPost<TransactionRow>(`/api/money/category?id=${encodeURIComponent(id)}`, { category });
}

/** Manual entry for money in/out that never arrives via SMS/notification (cash, transfers, etc.). */
export async function addManualTransaction(input: {
  amount: number;
  direction: 'debit' | 'credit';
  merchant?: string;
  bankAccountId: string;
}): Promise<TransactionRow> {
  return apiPost<TransactionRow>('/api/money', {
    amount: input.amount.toFixed(2),
    direction: input.direction,
    merchant: input.merchant,
    bankAccountId: input.bankAccountId,
    source: 'manual',
    occurredAt: new Date().toISOString(),
    dedupRef: `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`,
  });
}

export type BankAccount = {
  id: string;
  bankName: string;
  lastDigits: string;
  cardType: 'debit' | 'credit';
  label: string | null;
  limitAmount: string | null;
};

/** This-month debit total per bankAccountId, for the Limits and Account tabs. */
export function spendByAccount(transactions: TransactionRow[]): Record<string, number> {
  const { start, end } = monthBounds();
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.direction !== 'debit' || !t.bankAccountId) continue;
    const ts = new Date(t.occurredAt).getTime();
    if (ts < start || ts >= end) continue;
    result[t.bankAccountId] = (result[t.bankAccountId] ?? 0) + Number(t.amount);
  }
  return result;
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const res = await apiGet<{ accounts: BankAccount[] }>('/api/money/accounts');
  return res.accounts;
}

export async function addBankAccount(input: {
  bankName: string;
  lastDigits: string;
  cardType: 'debit' | 'credit';
  label?: string;
}): Promise<BankAccount> {
  return apiPost<BankAccount>('/api/money/accounts', input);
}

export async function removeBankAccount(id: string): Promise<void> {
  await apiDelete(`/api/money/accounts?id=${encodeURIComponent(id)}`);
}

export async function setBankAccountLimit(id: string, limitAmount: number | null): Promise<BankAccount> {
  return apiPatch<BankAccount>(`/api/money/accounts?id=${encodeURIComponent(id)}`, {
    limitAmount: limitAmount != null ? limitAmount.toFixed(2) : null,
  });
}

export type MonthSummary = {
  totalSpend: number;
  totalIncome: number;
  byCategory: { category: string; total: number }[];
};

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  return { start, end };
}

export function summarizeMonth(transactions: TransactionRow[]): MonthSummary {
  const { start, end } = monthBounds();
  const inMonth = transactions.filter((t) => {
    const ts = new Date(t.occurredAt).getTime();
    return ts >= start && ts < end;
  });

  let totalSpend = 0;
  let totalIncome = 0;
  const byCategoryMap = new Map<string, number>();
  for (const t of inMonth) {
    const amount = Number(t.amount);
    if (t.direction === 'debit') {
      totalSpend += amount;
      const category = t.category ?? 'Uncategorized';
      byCategoryMap.set(category, (byCategoryMap.get(category) ?? 0) + amount);
    } else {
      totalIncome += amount;
    }
  }

  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

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
  const groups = new Map<string, { merchant: string; amount: number; occurredAt: number }[]>();
  for (const tx of transactions) {
    if (tx.direction !== 'debit' || !tx.merchant) continue;
    const amount = Number(tx.amount);
    const key = `${tx.merchant.toLowerCase()}:${amount}`;
    const group = groups.get(key) ?? [];
    group.push({ merchant: tx.merchant, amount, occurredAt: new Date(tx.occurredAt).getTime() });
    groups.set(key, group);
  }

  const guesses: SubscriptionGuess[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.occurredAt - b.occurredAt);
    const gaps = group.slice(1).map((tx, i) => tx.occurredAt - group[i].occurredAt);
    const looksMonthly = gaps.every((gap) => Math.abs(gap - THIRTY_DAYS_MS) < RECURRING_TOLERANCE_MS);
    if (!looksMonthly) continue;

    const last = group[group.length - 1];
    guesses.push({
      merchant: last.merchant,
      amount: last.amount,
      lastOccurredAt: last.occurredAt,
      estimatedNextDate: last.occurredAt + THIRTY_DAYS_MS,
      occurrences: group.length,
    });
  }
  return guesses;
}
