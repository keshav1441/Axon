import { pgTable, text, integer, numeric, timestamp, index, unique, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: unique('users_email_unique').on(t.email),
  phoneUnique: unique('users_phone_unique').on(t.phone),
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bankName: text('bank_name').notNull(),
  lastDigits: text('last_digits').notNull(),
  cardType: text('card_type').notNull(),
  label: text('label'),
  limitAmount: numeric('limit_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('bank_accounts_user_idx').on(t.userId),
}));

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bankAccountId: text('bank_account_id').references(() => bankAccounts.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  direction: text('direction').notNull(),
  merchant: text('merchant'),
  category: text('category'),
  accountTail: text('account_tail'),
  source: text('source').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  dedupRef: text('dedup_ref').notNull(),
  dedupRefHash: text('dedup_ref_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userOccurredIdx: index('transactions_user_occurred_idx').on(t.userId, t.occurredAt),
  dedupRefIdx: index('transactions_dedup_ref_idx').on(t.dedupRef),
  dedupRefHashIdx: index('transactions_dedup_ref_hash_idx').on(t.dedupRefHash),
}));

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  parentTaskId: text('parent_task_id'),
  status: text('status').notNull().default('open'),
  nagSchedule: text('nag_schedule'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userStatusIdx: index('tasks_user_status_idx').on(t.userId, t.status),
}));

export const focusSessions = pgTable('focus_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  appPackage: text('app_package').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  budgetMinutes: integer('budget_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authAttempts = pgTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});

export const focusApps = pgTable('focus_apps', {
  userId: text('user_id').notNull().references(() => users.id),
  packageName: text('package_name').notNull(),
  label: text('label').notNull(),
  budgetMinutes: integer('budget_minutes'),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.packageName] }),
}));

export const categoryRules = pgTable('category_rules', {
  userId: text('user_id').notNull().references(() => users.id),
  keyword: text('keyword').notNull(),
  category: text('category').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.keyword] }),
}));
