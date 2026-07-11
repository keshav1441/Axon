export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    merchant TEXT,
    category TEXT,
    account_tail TEXT,
    source TEXT NOT NULL CHECK (source IN ('sms', 'notification')),
    occurred_at INTEGER NOT NULL,
    dedupe_key TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at);`,

  `CREATE TABLE IF NOT EXISTS category_rules (
    keyword TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    nag_interval_minutes INTEGER,
    created_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks (task_id);`,

  `CREATE TABLE IF NOT EXISTS focus_apps (
    package_name TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    budget_minutes INTEGER
  );`,

  `CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    package_name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_seconds INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions (started_at);`,

  `CREATE TABLE IF NOT EXISTS focus_streak_days (
    date TEXT PRIMARY KEY NOT NULL,
    under_budget INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`,
];
