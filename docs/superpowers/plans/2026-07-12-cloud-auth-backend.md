# Cloud Auth Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a standalone Vercel serverless backend (`backend/`) backed by Neon Postgres via Drizzle ORM, exposing auth (signup/login/refresh/logout) and data CRUD (money, tasks, focus, dashboard) endpoints, secured with JWT.

**Architecture:** Thin Vercel Node serverless functions under `backend/api/*` are adapters that parse the request, call a pure handler function under `backend/src/handlers/*` (fully unit-testable without HTTP), and serialize the result. All DB access goes through Drizzle (`backend/src/db`). Auth uses bcrypt-hashed passwords, short-lived JWT access tokens, and DB-tracked refresh tokens.

**Tech Stack:** TypeScript, Vercel (`@vercel/node`), Drizzle ORM (`drizzle-orm/neon-http`), `@neondatabase/serverless`, `bcryptjs`, `jsonwebtoken`, `zod`, `vitest`.

**This is Plan A of two.** It covers the backend only, and is independently testable (via `vitest` and `curl`/`vercel dev`) without the RN app. Plan B (retiring `src/db/*`, wiring the RN app to this API, login/signup screens, offline write queue) is a separate follow-up plan against `docs/superpowers/specs/2026-07-12-cloud-auth-design.md`, written once this backend is deployed and its URL is known.

## Global Constraints

- Neon connection string (`DATABASE_URL`) lives only in Vercel/local `.env` files, **never** committed. The connection string shared during design (`postgresql://neondb_owner:...@ep-floral-violet-aol9x1zh...`) must be rotated in the Neon console before production use — treat it as already-compromised.
- Password hashing: `bcryptjs` (pure JS — avoids native-binding issues on Vercel's Node runtime), cost factor 12.
- Access tokens: JWT, HS256, 15 minute expiry, payload `{ sub: <userId> }`.
- Refresh tokens: random 32-byte hex, format `<sessionId>.<random>`, only a SHA-256 hash stored server-side, 30 day expiry, rotated on every use.
- All data tables scoped by `user_id`; every data-route handler must filter by the authenticated user's id.
- Minimum password length: 8 characters. Email and phone must each be unique across `users`.
- Backend package manager: npm (matches root project).

---

## File Structure

```
backend/
  package.json
  tsconfig.json
  vercel.json
  drizzle.config.ts
  vitest.config.ts
  .env.example
  src/
    db/
      schema.ts              # Drizzle table definitions
      client.ts               # drizzle(neon(...)) instance factory
    lib/
      password.ts             # hashPassword / verifyPassword
      tokens.ts                # access + refresh token sign/verify/hash
      rateLimit.ts              # checkAndRecordAttempt
      http.ts                    # ok()/err() response helpers, requireAuth()
    handlers/
      auth/
        signup.ts
        login.ts
        refresh.ts
        logout.ts
      money/
        createTransaction.ts
        listTransactions.ts
      tasks/
        createTask.ts
        listTasks.ts
        updateTaskStatus.ts
      focus/
        createSession.ts
        listSessions.ts
      dashboard/
        summary.ts
  api/
    auth/
      signup.ts
      login.ts
      refresh.ts
      logout.ts
    money/
      index.ts
    tasks/
      index.ts
      status.ts
    focus/
      index.ts
    dashboard/
      summary.ts
  test/
    lib/
      password.test.ts
      tokens.test.ts
      rateLimit.test.ts
    handlers/
      auth/
        signup.test.ts
        login.test.ts
        refresh.test.ts
        logout.test.ts
      money/
        createTransaction.test.ts
        listTransactions.test.ts
      tasks/
        createTask.test.ts
        listTasks.test.ts
        updateTaskStatus.test.ts
      focus/
        createSession.test.ts
        listSessions.test.ts
      dashboard/
        summary.test.ts
```

---

### Task 1: Backend project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vercel.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/vitest.config.ts`

**Interfaces:**
- Produces: an npm project at `backend/` with `dev`, `build`, `test` scripts other tasks assume exist.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "axon-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run",
    "dev": "vercel dev",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.36.4",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.2",
    "@vercel/node": "^3.2.29",
    "drizzle-kit": "^0.28.1",
    "typescript": "^5.7.2",
    "vercel": "^39.1.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "api", "test", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `backend/vercel.json`**

```json
{
  "version": 2,
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  }
}
```

- [ ] **Step 4: Create `backend/.env.example`**

```
DATABASE_URL=
TEST_DATABASE_URL=
JWT_ACCESS_SECRET=
REFRESH_TOKEN_PEPPER=
```

- [ ] **Step 5: Create `backend/.gitignore`**

```
node_modules/
dist/
.env
.vercel/
```

- [ ] **Step 6: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['dotenv/config'],
    testTimeout: 15000,
  },
});
```

- [ ] **Step 7: Install dependencies**

Run: `cd backend && npm install`
Expected: installs without errors, creates `backend/package-lock.json`.

- [ ] **Step 8: Add `dotenv` for test env loading**

Run: `cd backend && npm install --save-dev dotenv`

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/vercel.json backend/.env.example backend/.gitignore backend/vitest.config.ts
git commit -m "chore(backend): scaffold Vercel + Drizzle backend project"
```

---

### Task 2: Drizzle schema and Neon migration

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/db/client.ts`
- Test: `backend/test/db/client.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance, exported from `src/db/client.ts` as `export function getDb(connectionString: string)`), and table exports `users`, `sessions`, `transactions`, `tasks`, `focusSessions`, `authAttempts` from `src/db/schema.ts`, all consumed by every handler task below.

**Prerequisite (manual, one-time):** In the Neon console (or `neonctl branches create --name test --parent main`), create a branch named `test` off the `neondb` database provided by the user. Its connection string goes in `backend/.env` as `TEST_DATABASE_URL`; the original main connection string goes in `DATABASE_URL`. Copy `backend/.env.example` to `backend/.env` and fill both in, plus a random 32+ char value for `JWT_ACCESS_SECRET` and `REFRESH_TOKEN_PEPPER` (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` run twice).

- [ ] **Step 1: Write `backend/src/db/schema.ts`**

```typescript
import { pgTable, text, integer, numeric, timestamp, index, unique } from 'drizzle-orm/pg-core';

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

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  direction: text('direction').notNull(),
  merchant: text('merchant'),
  category: text('category'),
  source: text('source').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  dedupRef: text('dedup_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userOccurredIdx: index('transactions_user_occurred_idx').on(t.userId, t.occurredAt),
  dedupRefIdx: index('transactions_dedup_ref_idx').on(t.dedupRef),
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
```

- [ ] **Step 2: Write `backend/src/db/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export function getDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 3: Write `backend/drizzle.config.ts`**

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Generate and apply migration to both branches**

Run: `cd backend && npm run db:generate`
Expected: creates `backend/drizzle/0000_*.sql` with `CREATE TABLE` statements for all six tables.

Run: `cd backend && npm run db:migrate`
Expected: applies to `DATABASE_URL` (main branch). Prints applied migration name.

Run: `cd backend && DATABASE_URL=$TEST_DATABASE_URL npx drizzle-kit migrate` (or set `TEST_DATABASE_URL` into `DATABASE_URL` temporarily)
Expected: applies same migration to the `test` branch.

- [ ] **Step 5: Write `backend/test/db/client.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { getDb } from '../../src/db/client';
import { users } from '../../src/db/schema';

describe('db client', () => {
  it('connects and can query an empty result', async () => {
    const db = getDb(process.env.TEST_DATABASE_URL!);
    const rows = await db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npm test -- test/db/client.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add backend/drizzle.config.ts backend/src/db backend/drizzle backend/test/db
git commit -m "feat(backend): add Drizzle schema and Neon migration"
```

---

### Task 3: Password hashing lib

**Files:**
- Create: `backend/src/lib/password.ts`
- Test: `backend/test/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` — consumed by Task 7 (signup) and Task 8 (login).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password';

describe('password lib', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/lib/password.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/password'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import bcrypt from 'bcryptjs';

const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/lib/password.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/password.ts backend/test/lib/password.test.ts
git commit -m "feat(backend): add bcrypt password hashing lib"
```

---

### Task 4: Access + refresh token lib

**Files:**
- Create: `backend/src/lib/tokens.ts`
- Test: `backend/test/lib/tokens.test.ts`

**Interfaces:**
- Consumes: none.
- Produces:
  - `signAccessToken(userId: string, secret: string): string`
  - `verifyAccessToken(token: string, secret: string): { sub: string } | null`
  - `generateRefreshToken(sessionId: string): string` (format `<sessionId>.<random>`)
  - `hashRefreshToken(token: string, pepper: string): string` (SHA-256 hex)
  - `parseRefreshTokenSessionId(token: string): string | null`
  All consumed by Task 7 (signup), Task 8 (login), Task 9 (refresh), Task 11 (requireAuth).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenSessionId,
} from '../../src/lib/tokens';

describe('tokens lib', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken('user-1', 'test-secret');
    const payload = verifyAccessToken(token, 'test-secret');
    expect(payload?.sub).toBe('user-1');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken('user-1', 'test-secret');
    expect(verifyAccessToken(token, 'other-secret')).toBeNull();
  });

  it('generates a refresh token embedding the session id, hashes deterministically', () => {
    const token = generateRefreshToken('session-1');
    expect(parseRefreshTokenSessionId(token)).toBe('session-1');
    const hash1 = hashRefreshToken(token, 'pepper');
    const hash2 = hashRefreshToken(token, 'pepper');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/lib/tokens.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import jwt from 'jsonwebtoken';
import { randomBytes, createHmac } from 'node:crypto';

export function signAccessToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string, secret: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      return { sub: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString('hex')}`;
}

export function hashRefreshToken(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('hex');
}

export function parseRefreshTokenSessionId(token: string): string | null {
  const idx = token.indexOf('.');
  if (idx === -1) return null;
  return token.slice(0, idx);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/lib/tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/tokens.ts backend/test/lib/tokens.test.ts
git commit -m "feat(backend): add JWT access + refresh token lib"
```

---

### Task 5: Rate limiter lib

**Files:**
- Create: `backend/src/lib/rateLimit.ts`
- Test: `backend/test/lib/rateLimit.test.ts`

**Interfaces:**
- Consumes: `Db` type and `authAttempts` table from Task 2.
- Produces: `checkAndRecordAttempt(db: Db, key: string, maxAttempts?: number, windowMinutes?: number): Promise<boolean>` (true = allowed and recorded, false = rate-limited) — consumed by Task 7 (signup) and Task 8 (login).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '../../src/db/client';
import { authAttempts } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { checkAndRecordAttempt } from '../../src/lib/rateLimit';

const db = getDb(process.env.TEST_DATABASE_URL!);
const testKey = 'test:rate-limit-key';

afterEach(async () => {
  await db.delete(authAttempts).where(eq(authAttempts.key, testKey));
});

describe('rateLimit lib', () => {
  it('allows attempts under the max, blocks once exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await checkAndRecordAttempt(db, testKey, 5, 15)).toBe(true);
    }
    expect(await checkAndRecordAttempt(db, testKey, 5, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/lib/rateLimit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { authAttempts } from '../db/schema';

export async function checkAndRecordAttempt(
  db: Db,
  key: string,
  maxAttempts = 5,
  windowMinutes = 15,
): Promise<boolean> {
  const now = new Date();
  const [existing] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);

  if (!existing || now.getTime() - existing.windowStart.getTime() > windowMinutes * 60_000) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: authAttempts.key, set: { count: 1, windowStart: now } });
    return true;
  }

  if (existing.count >= maxAttempts) {
    return false;
  }

  await db
    .update(authAttempts)
    .set({ count: existing.count + 1 })
    .where(eq(authAttempts.key, key));
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/lib/rateLimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/rateLimit.ts backend/test/lib/rateLimit.test.ts
git commit -m "feat(backend): add Postgres-backed auth rate limiter"
```

---

### Task 6: HTTP helpers (`ok`/`err`/`requireAuth`)

**Files:**
- Create: `backend/src/lib/http.ts`
- Test: `backend/test/lib/http.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` from Task 4.
- Produces:
  - `ok(res: VercelResponse, status: number, body: unknown): void`
  - `err(res: VercelResponse, status: number, code: string, message: string): void`
  - `requireAuth(req: VercelRequest, secret: string): { userId: string } | null`
  - `getClientIp(req: VercelRequest): string`
  Consumed by every `api/*` route adapter (Tasks 10, 13, 15, 17, 19).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { requireAuth, getClientIp } from '../../src/lib/http';
import { signAccessToken } from '../../src/lib/tokens';

describe('http lib', () => {
  it('requireAuth returns userId for a valid bearer token', () => {
    const token = signAccessToken('user-42', 'secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    expect(requireAuth(req, 'secret')).toEqual({ userId: 'user-42' });
  });

  it('requireAuth returns null when header is missing or invalid', () => {
    expect(requireAuth({ headers: {} } as any, 'secret')).toBeNull();
    expect(requireAuth({ headers: { authorization: 'Bearer garbage' } } as any, 'secret')).toBeNull();
  });

  it('getClientIp reads x-forwarded-for first entry', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} } as any;
    expect(getClientIp(req)).toBe('1.2.3.4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/lib/http.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken } from './tokens';

export function ok(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function err(res: VercelResponse, status: number, code: string, message: string): void {
  res.status(status).json({ error: message, code });
}

export function requireAuth(req: VercelRequest, secret: string): { userId: string } | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  const payload = verifyAccessToken(token, secret);
  if (!payload) return null;
  return { userId: payload.sub };
}

export function getClientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/lib/http.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/http.ts backend/test/lib/http.test.ts
git commit -m "feat(backend): add HTTP response and auth helpers"
```

---

### Task 7: Signup handler

**Files:**
- Create: `backend/src/handlers/auth/signup.ts`
- Test: `backend/test/handlers/auth/signup.test.ts`

**Interfaces:**
- Consumes: `Db`/`getDb` (Task 2), `users`/`sessions` tables (Task 2), `hashPassword` (Task 3), `signAccessToken`/`generateRefreshToken`/`hashRefreshToken` (Task 4), `checkAndRecordAttempt` (Task 5).
- Produces: `signup(db: Db, input: unknown, secrets: { jwtSecret: string; refreshPepper: string }): Promise<SignupResult>` where
  ```typescript
  type SignupResult =
    | { ok: true; status: 201; body: { accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string } } }
    | { ok: false; status: 400 | 409; body: { error: string; code: string } };
  ```
  Consumed by Task 10 (`api/auth/signup.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'signup-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('signup handler', () => {
  it('creates a user and returns a token pair on valid input', async () => {
    const result = await signup(db, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: testEmail,
      phone: '9999999999',
      password: 'correct-horse-battery',
      confirmPassword: 'correct-horse-battery',
    }, secrets);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.body.user.email).toBe(testEmail);
      expect(result.body.accessToken).toBeTypeOf('string');
      expect(result.body.refreshToken).toBeTypeOf('string');
    }
  });

  it('rejects mismatched passwords', async () => {
    const result = await signup(db, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: testEmail,
      phone: '9999999999',
      password: 'correct-horse-battery',
      confirmPassword: 'different',
    }, secrets);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.body.code).toBe('PASSWORD_MISMATCH');
    }
  });

  it('rejects a duplicate email', async () => {
    await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '9999999999',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);

    const result = await signup(db, {
      firstName: 'Bea', lastName: 'Loveless', email: testEmail, phone: '8888888888',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('EMAIL_TAKEN');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/handlers/auth/signup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { randomUUID } from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { users, sessions } from '../../db/schema';
import { hashPassword } from '../../lib/password';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../lib/tokens';
import { checkAndRecordAttempt } from '../../lib/rateLimit';

const SignupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export type SignupResult =
  | { ok: true; status: 201; body: { accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string } } }
  | { ok: false; status: 400 | 409; body: { error: string; code: string } };

export async function signup(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<SignupResult> {
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid signup fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;

  if (data.password !== data.confirmPassword) {
    return { ok: false, status: 400, body: { error: 'Passwords do not match', code: 'PASSWORD_MISMATCH' } };
  }

  const allowed = await checkAndRecordAttempt(db, `signup:${data.email}`);
  if (!allowed) {
    return { ok: false, status: 400, body: { error: 'Too many attempts, try again later', code: 'RATE_LIMITED' } };
  }

  const existing = await db.select().from(users).where(or(eq(users.email, data.email), eq(users.phone, data.phone))).limit(1);
  if (existing.length > 0) {
    const code = existing[0].email === data.email ? 'EMAIL_TAKEN' : 'PHONE_TAKEN';
    return { ok: false, status: 409, body: { error: 'Account already exists', code } };
  }

  const passwordHash = await hashPassword(data.password);
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    passwordHash,
  });

  const sessionId = randomUUID();
  const refreshToken = generateRefreshToken(sessionId);
  const refreshTokenHash = hashRefreshToken(refreshToken, secrets.refreshPepper);
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const accessToken = signAccessToken(userId, secrets.jwtSecret);

  return {
    ok: true,
    status: 201,
    body: {
      accessToken,
      refreshToken,
      user: { id: userId, firstName: data.firstName, lastName: data.lastName, email: data.email },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/handlers/auth/signup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/auth/signup.ts backend/test/handlers/auth/signup.test.ts
git commit -m "feat(backend): add signup handler with validation and rate limiting"
```

---

### Task 8: Login handler

**Files:**
- Create: `backend/src/handlers/auth/login.ts`
- Test: `backend/test/handlers/auth/login.test.ts`

**Interfaces:**
- Consumes: same libs as Task 7, plus `verifyPassword` (Task 3).
- Produces: `login(db: Db, input: unknown, secrets: { jwtSecret: string; refreshPepper: string }): Promise<LoginResult>`, `LoginResult` shaped like `SignupResult` but `status: 200 | 400 | 401`, `code: 'INVALID_INPUT' | 'RATE_LIMITED' | 'INVALID_CREDENTIALS'`. Consumed by Task 10.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { login } from '../../../src/handlers/auth/login';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'login-test@example.com';

beforeEach(async () => {
  await signup(db, {
    firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '7777777777',
    password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
  }, secrets);
});

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
  await db.delete(authAttempts).where(eq(authAttempts.key, `login:${testEmail}`));
});

describe('login handler', () => {
  it('logs in with correct credentials', async () => {
    const result = await login(db, { email: testEmail, password: 'correct-horse-battery' }, secrets);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body.user.email).toBe(testEmail);
    }
  });

  it('rejects a wrong password', async () => {
    const result = await login(db, { email: testEmail, password: 'wrong-password' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('rejects an unknown email', async () => {
    const result = await login(db, { email: 'nobody@example.com', password: 'whatever1' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/handlers/auth/login.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { users, sessions } from '../../db/schema';
import { verifyPassword } from '../../lib/password';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../lib/tokens';
import { checkAndRecordAttempt } from '../../lib/rateLimit';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginResult =
  | { ok: true; status: 200; body: { accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string } } }
  | { ok: false; status: 400 | 401; body: { error: string; code: string } };

export async function login(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<LoginResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid login fields', code: 'INVALID_INPUT' } };
  }
  const { email, password } = parsed.data;

  const allowed = await checkAndRecordAttempt(db, `login:${email}`);
  if (!allowed) {
    return { ok: false, status: 400, body: { error: 'Too many attempts, try again later', code: 'RATE_LIMITED' } };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, status: 401, body: { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } };
  }

  const sessionId = randomUUID();
  const refreshToken = generateRefreshToken(sessionId);
  const refreshTokenHash = hashRefreshToken(refreshToken, secrets.refreshPepper);
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const accessToken = signAccessToken(user.id, secrets.jwtSecret);

  return {
    ok: true,
    status: 200,
    body: {
      accessToken,
      refreshToken,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/handlers/auth/login.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/auth/login.ts backend/test/handlers/auth/login.test.ts
git commit -m "feat(backend): add login handler"
```

---

### Task 9: Refresh + logout handlers

**Files:**
- Create: `backend/src/handlers/auth/refresh.ts`
- Create: `backend/src/handlers/auth/logout.ts`
- Test: `backend/test/handlers/auth/refresh.test.ts`
- Test: `backend/test/handlers/auth/logout.test.ts`

**Interfaces:**
- Consumes: `sessions` table (Task 2), `parseRefreshTokenSessionId`/`hashRefreshToken`/`generateRefreshToken`/`signAccessToken` (Task 4).
- Produces:
  - `refreshTokens(db: Db, input: unknown, secrets: { jwtSecret: string; refreshPepper: string }): Promise<RefreshResult>` — `RefreshResult` is `{ ok: true; status: 200; body: { accessToken: string; refreshToken: string } } | { ok: false; status: 400 | 401; body: { error: string; code: string } }`.
  - `logout(db: Db, input: unknown): Promise<{ ok: true; status: 204 } | { ok: false; status: 400; body: { error: string; code: string } }>`
  Consumed by Task 10.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/test/handlers/auth/refresh.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { refreshTokens } from '../../../src/handlers/auth/refresh';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'refresh-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('refresh handler', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const signupResult = await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '6666666666',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);
    if (!signupResult.ok) throw new Error('signup failed in test setup');

    const result = await refreshTokens(db, { refreshToken: signupResult.body.refreshToken }, secrets);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.accessToken).toBeTypeOf('string');
      expect(result.body.refreshToken).not.toBe(signupResult.body.refreshToken);
    }

    const reuse = await refreshTokens(db, { refreshToken: signupResult.body.refreshToken }, secrets);
    expect(reuse.ok).toBe(false);
  });

  it('rejects a malformed refresh token', async () => {
    const result = await refreshTokens(db, { refreshToken: 'garbage' }, secrets);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
```

```typescript
// backend/test/handlers/auth/logout.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { users, sessions, authAttempts } from '../../../src/db/schema';
import { signup } from '../../../src/handlers/auth/signup';
import { logout } from '../../../src/handlers/auth/logout';

const db = getDb(process.env.TEST_DATABASE_URL!);
const secrets = { jwtSecret: 'test-secret', refreshPepper: 'test-pepper' };
const testEmail = 'logout-test@example.com';

afterEach(async () => {
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, `signup:${testEmail}`));
});

describe('logout handler', () => {
  it('deletes the session for the given refresh token', async () => {
    const signupResult = await signup(db, {
      firstName: 'Ada', lastName: 'Lovelace', email: testEmail, phone: '5555555555',
      password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery',
    }, secrets);
    if (!signupResult.ok) throw new Error('signup failed in test setup');

    const result = await logout(db, { refreshToken: signupResult.body.refreshToken });
    expect(result.ok).toBe(true);

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, signupResult.body.user.id));
    expect(remaining.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- test/handlers/auth/refresh.test.ts test/handlers/auth/logout.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/handlers/auth/refresh.ts
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { sessions } from '../../db/schema';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenSessionId,
} from '../../lib/tokens';

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

export type RefreshResult =
  | { ok: true; status: 200; body: { accessToken: string; refreshToken: string } }
  | { ok: false; status: 400 | 401; body: { error: string; code: string } };

export async function refreshTokens(
  db: Db,
  input: unknown,
  secrets: { jwtSecret: string; refreshPepper: string },
): Promise<RefreshResult> {
  const parsed = RefreshSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
  }

  const sessionId = parseRefreshTokenSessionId(parsed.data.refreshToken);
  if (!sessionId) {
    return { ok: false, status: 401, body: { error: 'Invalid refresh token', code: 'INVALID_TOKEN' } };
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const expectedHash = session ? hashRefreshToken(parsed.data.refreshToken, secrets.refreshPepper) : null;

  if (!session || expectedHash !== session.refreshTokenHash || session.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, body: { error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' } };
  }

  const newRefreshToken = generateRefreshToken(sessionId);
  const newHash = hashRefreshToken(newRefreshToken, secrets.refreshPepper);
  await db
    .update(sessions)
    .set({ refreshTokenHash: newHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
    .where(eq(sessions.id, sessionId));

  const accessToken = signAccessToken(session.userId, secrets.jwtSecret);

  return { ok: true, status: 200, body: { accessToken, refreshToken: newRefreshToken } };
}
```

```typescript
// backend/src/handlers/auth/logout.ts
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { sessions } from '../../db/schema';
import { parseRefreshTokenSessionId } from '../../lib/tokens';

const LogoutSchema = z.object({ refreshToken: z.string().min(1) });

export async function logout(
  db: Db,
  input: unknown,
): Promise<{ ok: true; status: 204 } | { ok: false; status: 400; body: { error: string; code: string } }> {
  const parsed = LogoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
  }
  const sessionId = parseRefreshTokenSessionId(parsed.data.refreshToken);
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  return { ok: true, status: 204 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- test/handlers/auth/refresh.test.ts test/handlers/auth/logout.test.ts`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/auth/refresh.ts backend/src/handlers/auth/logout.ts backend/test/handlers/auth/refresh.test.ts backend/test/handlers/auth/logout.test.ts
git commit -m "feat(backend): add refresh token rotation and logout handlers"
```

---

### Task 10: Vercel auth route adapters

**Files:**
- Create: `backend/api/auth/signup.ts`
- Create: `backend/api/auth/login.ts`
- Create: `backend/api/auth/refresh.ts`
- Create: `backend/api/auth/logout.ts`

**Interfaces:**
- Consumes: `signup` (Task 7), `login` (Task 8), `refreshTokens`/`logout` (Task 9), `getDb` (Task 2), `ok`/`err` (Task 6).
- Produces: live HTTP endpoints `POST /api/auth/{signup,login,refresh,logout}`.

- [ ] **Step 1: Write `backend/api/auth/signup.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { signup } from '../../src/handlers/auth/signup';
import { ok, err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await signup(db, req.body, {
    jwtSecret: process.env.JWT_ACCESS_SECRET!,
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER!,
  });
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
```

- [ ] **Step 2: Write `backend/api/auth/login.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { login } from '../../src/handlers/auth/login';
import { ok, err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await login(db, req.body, {
    jwtSecret: process.env.JWT_ACCESS_SECRET!,
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER!,
  });
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
```

- [ ] **Step 3: Write `backend/api/auth/refresh.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { refreshTokens } from '../../src/handlers/auth/refresh';
import { ok, err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await refreshTokens(db, req.body, {
    jwtSecret: process.env.JWT_ACCESS_SECRET!,
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER!,
  });
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
```

- [ ] **Step 4: Write `backend/api/auth/logout.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { logout } from '../../src/handlers/auth/logout';
import { err } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const db = getDb(process.env.DATABASE_URL!);
  const result = await logout(db, req.body);
  if (result.ok) return res.status(204).end();
  return err(res, result.status, result.body.code, result.body.error);
}
```

- [ ] **Step 5: Manual verification with `vercel dev`**

Run: `cd backend && npx vercel dev` (leave running; requires linking to a Vercel project on first run — accept defaults, it's only used locally here)

In another terminal:
```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"1234567890","password":"correct-horse-battery","confirmPassword":"correct-horse-battery"}'
```
Expected: `201` with `accessToken`, `refreshToken`, `user` in the JSON body.

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}'
```
Expected: `200` with a fresh token pair.

Clean up the test row from `DATABASE_URL` afterward (this hit the main branch, not `TEST_DATABASE_URL`):
```bash
cd backend && node -e "
const { getDb } = require('./dist/src/db/client');
" 
```
Simpler: connect with `psql "$DATABASE_URL"` and run `DELETE FROM users WHERE email = 'ada@example.com';` (cascades via manual delete of sessions first: `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'ada@example.com');`).

- [ ] **Step 6: Commit**

```bash
git add backend/api/auth
git commit -m "feat(backend): wire auth Vercel route adapters"
```

---

### Task 11: Money handlers (create + list, with dedup)

**Files:**
- Create: `backend/src/handlers/money/createTransaction.ts`
- Create: `backend/src/handlers/money/listTransactions.ts`
- Test: `backend/test/handlers/money/createTransaction.test.ts`
- Test: `backend/test/handlers/money/listTransactions.test.ts`

**Interfaces:**
- Consumes: `transactions` table (Task 2).
- Produces:
  - `createTransaction(db: Db, userId: string, input: unknown): Promise<CreateTxResult>` where a duplicate `dedupRef` for the same user returns the existing row instead of inserting (idempotent, matching the original spec's SMS+notification double-fire dedup).
  - `listTransactions(db: Db, userId: string): Promise<Transaction[]>`, newest first.
  Consumed by Task 12.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/test/handlers/money/createTransaction.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-money-create';

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
});

describe('createTransaction handler', () => {
  it('creates a transaction', async () => {
    const result = await createTransaction(db, userId, {
      amount: '250.00', direction: 'debit', merchant: 'Zomato', category: 'food',
      source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'ref-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.merchant).toBe('Zomato');
  });

  it('is idempotent on duplicate dedupRef for the same user', async () => {
    const input = {
      amount: '250.00', direction: 'debit', merchant: 'Zomato', category: 'food',
      source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'ref-dup',
    };
    const first = await createTransaction(db, userId, input);
    const second = await createTransaction(db, userId, { ...input, source: 'notif' });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.body.id).toBe(first.body.id);

    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(rows.filter((r) => r.dedupRef === 'ref-dup').length).toBe(1);
  });
});
```

```typescript
// backend/test/handlers/money/listTransactions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';
import { listTransactions } from '../../../src/handlers/money/listTransactions';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-money-list';
const otherUserId = 'test-user-money-list-other';

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, otherUserId));
});

describe('listTransactions handler', () => {
  it('returns only the requesting user\'s transactions, newest first', async () => {
    await createTransaction(db, userId, {
      amount: '10.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-10T10:00:00.000Z', dedupRef: 'a',
    });
    await createTransaction(db, userId, {
      amount: '20.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-11T10:00:00.000Z', dedupRef: 'b',
    });
    await createTransaction(db, otherUserId, {
      amount: '999.00', direction: 'debit', source: 'sms', occurredAt: '2026-07-12T10:00:00.000Z', dedupRef: 'c',
    });

    const rows = await listTransactions(db, userId);
    expect(rows.length).toBe(2);
    expect(rows[0].dedupRef).toBe('b');
    expect(rows[1].dedupRef).toBe('a');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- test/handlers/money`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/handlers/money/createTransaction.ts
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';

const CreateTransactionSchema = z.object({
  amount: z.string(),
  direction: z.enum(['debit', 'credit']),
  merchant: z.string().optional(),
  category: z.string().optional(),
  source: z.enum(['sms', 'notif']),
  occurredAt: z.string().datetime(),
  dedupRef: z.string().min(1),
});

export type CreateTxResult =
  | { ok: true; status: 200 | 201; body: typeof transactions.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createTransaction(db: Db, userId: string, input: unknown): Promise<CreateTxResult> {
  const parsed = CreateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid transaction fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;

  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.dedupRef, data.dedupRef)))
    .limit(1);
  if (existing) {
    return { ok: true, status: 200, body: existing };
  }

  const id = randomUUID();
  await db.insert(transactions).values({
    id,
    userId,
    amount: data.amount,
    direction: data.direction,
    merchant: data.merchant,
    category: data.category,
    source: data.source,
    occurredAt: new Date(data.occurredAt),
    dedupRef: data.dedupRef,
  });

  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return { ok: true, status: 201, body: row };
}
```

```typescript
// backend/src/handlers/money/listTransactions.ts
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions } from '../../db/schema';

export async function listTransactions(db: Db, userId: string) {
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.occurredAt));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- test/handlers/money`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/money backend/test/handlers/money
git commit -m "feat(backend): add money transaction create/list handlers with dedup"
```

---

### Task 12: Money Vercel route

**Files:**
- Create: `backend/api/money/index.ts`

**Interfaces:**
- Consumes: `createTransaction`/`listTransactions` (Task 11), `requireAuth`/`ok`/`err` (Task 6).
- Produces: `GET /api/money` (list), `POST /api/money` (create).

- [ ] **Step 1: Write `backend/api/money/index.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createTransaction } from '../../src/handlers/money/createTransaction';
import { listTransactions } from '../../src/handlers/money/listTransactions';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listTransactions(db, auth.userId);
    return ok(res, 200, { transactions: rows });
  }

  if (req.method === 'POST') {
    const result = await createTransaction(db, auth.userId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET or POST');
}
```

- [ ] **Step 2: Manual verification**

Run: `cd backend && npx vercel dev` (if not already running from Task 10)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"email":"ada@example.com","password":"correct-horse-battery"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s -X POST http://localhost:3000/api/money -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amount":"499.00","direction":"debit","merchant":"Swiggy","category":"food","source":"sms","occurredAt":"2026-07-12T10:00:00.000Z","dedupRef":"manual-1"}'
curl -s http://localhost:3000/api/money -H "authorization: Bearer $TOKEN"
```
Expected: POST returns `201` with the transaction; GET returns `{"transactions":[...]}` including it. Clean up via `psql` as in Task 10 Step 5.

- [ ] **Step 3: Commit**

```bash
git add backend/api/money
git commit -m "feat(backend): wire money Vercel route"
```

---

### Task 13: Tasks handlers (create, list, update status)

**Files:**
- Create: `backend/src/handlers/tasks/createTask.ts`
- Create: `backend/src/handlers/tasks/listTasks.ts`
- Create: `backend/src/handlers/tasks/updateTaskStatus.ts`
- Test: `backend/test/handlers/tasks/createTask.test.ts`
- Test: `backend/test/handlers/tasks/listTasks.test.ts`
- Test: `backend/test/handlers/tasks/updateTaskStatus.test.ts`

**Interfaces:**
- Consumes: `tasks` table (Task 2).
- Produces:
  - `createTask(db: Db, userId: string, input: unknown): Promise<CreateTaskResult>` — accepts optional `parentTaskId` for subtasks.
  - `listTasks(db: Db, userId: string): Promise<Task[]>`.
  - `updateTaskStatus(db: Db, userId: string, taskId: string, input: unknown): Promise<UpdateStatusResult>` — 404 if the task doesn't belong to `userId`.
  Consumed by Task 14.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/test/handlers/tasks/createTask.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-create';

afterEach(async () => {
  await db.delete(tasks).where(eq(tasks.userId, userId));
});

describe('createTask handler', () => {
  it('creates a task with default status open', async () => {
    const result = await createTask(db, userId, { title: 'Book flight' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.title).toBe('Book flight');
      expect(result.body.status).toBe('open');
    }
  });

  it('rejects an empty title', async () => {
    const result = await createTask(db, userId, { title: '' });
    expect(result.ok).toBe(false);
  });
});
```

```typescript
// backend/test/handlers/tasks/listTasks.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { listTasks } from '../../../src/handlers/tasks/listTasks';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-list';
const otherUserId = 'test-user-tasks-list-other';

afterEach(async () => {
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, otherUserId));
});

describe('listTasks handler', () => {
  it('returns only the requesting user\'s tasks', async () => {
    await createTask(db, userId, { title: 'Mine' });
    await createTask(db, otherUserId, { title: 'Not mine' });

    const rows = await listTasks(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Mine');
  });
});
```

```typescript
// backend/test/handlers/tasks/updateTaskStatus.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { tasks } from '../../../src/db/schema';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { updateTaskStatus } from '../../../src/handlers/tasks/updateTaskStatus';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-tasks-status';
const otherUserId = 'test-user-tasks-status-other';

afterEach(async () => {
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, otherUserId));
});

describe('updateTaskStatus handler', () => {
  it('updates status for a task owned by the user', async () => {
    const created = await createTask(db, userId, { title: 'Book flight' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTaskStatus(db, userId, created.body.id, { status: 'done' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.status).toBe('done');
  });

  it('returns not-found for a task owned by another user', async () => {
    const created = await createTask(db, otherUserId, { title: 'Not mine' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTaskStatus(db, userId, created.body.id, { status: 'done' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- test/handlers/tasks`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/handlers/tasks/createTask.ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  parentTaskId: z.string().optional(),
  nagSchedule: z.string().optional(),
});

export type CreateTaskResult =
  | { ok: true; status: 201; body: typeof tasks.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createTask(db: Db, userId: string, input: unknown): Promise<CreateTaskResult> {
  const parsed = CreateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid task fields', code: 'INVALID_INPUT' } };
  }
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    userId,
    title: parsed.data.title,
    parentTaskId: parsed.data.parentTaskId,
    nagSchedule: parsed.data.nagSchedule,
    status: 'open',
  });
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return { ok: true, status: 201, body: row };
}
```

```typescript
// backend/src/handlers/tasks/listTasks.ts
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

export async function listTasks(db: Db, userId: string) {
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}
```

```typescript
// backend/src/handlers/tasks/updateTaskStatus.ts
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { tasks } from '../../db/schema';

const UpdateStatusSchema = z.object({ status: z.enum(['open', 'done']) });

export type UpdateStatusResult =
  | { ok: true; status: 200; body: typeof tasks.$inferSelect }
  | { ok: false; status: 400 | 404; body: { error: string; code: string } };

export async function updateTaskStatus(
  db: Db,
  userId: string,
  taskId: string,
  input: unknown,
): Promise<UpdateStatusResult> {
  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid status', code: 'INVALID_INPUT' } };
  }

  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!existing) {
    return { ok: false, status: 404, body: { error: 'Task not found', code: 'NOT_FOUND' } };
  }

  await db.update(tasks).set({ status: parsed.data.status }).where(eq(tasks.id, taskId));
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return { ok: true, status: 200, body: row };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- test/handlers/tasks`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/tasks backend/test/handlers/tasks
git commit -m "feat(backend): add tasks create/list/update-status handlers"
```

---

### Task 14: Tasks Vercel routes

**Files:**
- Create: `backend/api/tasks/index.ts`
- Create: `backend/api/tasks/status.ts`

**Interfaces:**
- Consumes: handlers from Task 13, `requireAuth`/`ok`/`err` (Task 6).
- Produces: `GET/POST /api/tasks`, `POST /api/tasks/status?id=<taskId>`.

- [ ] **Step 1: Write `backend/api/tasks/index.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createTask } from '../../src/handlers/tasks/createTask';
import { listTasks } from '../../src/handlers/tasks/listTasks';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listTasks(db, auth.userId);
    return ok(res, 200, { tasks: rows });
  }

  if (req.method === 'POST') {
    const result = await createTask(db, auth.userId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET or POST');
}
```

- [ ] **Step 2: Write `backend/api/tasks/status.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { updateTaskStatus } from '../../src/handlers/tasks/updateTaskStatus';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const taskId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!taskId) return err(res, 400, 'INVALID_INPUT', 'Missing task id');

  const db = getDb(process.env.DATABASE_URL!);
  const result = await updateTaskStatus(db, auth.userId, taskId, req.body);
  if (result.ok) return ok(res, result.status, result.body);
  return err(res, result.status, result.body.code, result.body.error);
}
```

- [ ] **Step 3: Manual verification**

```bash
curl -s -X POST "http://localhost:3000/api/tasks" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"title":"Book flight"}'
curl -s "http://localhost:3000/api/tasks" -H "authorization: Bearer $TOKEN"
```
Expected: POST returns `201` with the task; GET returns `{"tasks":[...]}`. Grab the returned `id` and:
```bash
curl -s -X POST "http://localhost:3000/api/tasks/status?id=<id>" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"status":"done"}'
```
Expected: `200` with `status: "done"`.

- [ ] **Step 4: Commit**

```bash
git add backend/api/tasks
git commit -m "feat(backend): wire tasks Vercel routes"
```

---

### Task 15: Focus handlers (create session, list)

**Files:**
- Create: `backend/src/handlers/focus/createSession.ts`
- Create: `backend/src/handlers/focus/listSessions.ts`
- Test: `backend/test/handlers/focus/createSession.test.ts`
- Test: `backend/test/handlers/focus/listSessions.test.ts`

**Interfaces:**
- Consumes: `focusSessions` table (Task 2).
- Produces: `createSession(db: Db, userId: string, input: unknown): Promise<CreateSessionResult>`, `listSessions(db: Db, userId: string): Promise<FocusSession[]>`. Consumed by Task 16.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/test/handlers/focus/createSession.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { focusSessions } from '../../../src/db/schema';
import { createSession } from '../../../src/handlers/focus/createSession';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-focus-create';

afterEach(async () => {
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
});

describe('createSession handler', () => {
  it('creates a focus session', async () => {
    const result = await createSession(db, userId, {
      appPackage: 'com.instagram.android',
      startedAt: '2026-07-12T10:00:00.000Z',
      endedAt: '2026-07-12T10:15:00.000Z',
      budgetMinutes: 30,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.appPackage).toBe('com.instagram.android');
  });

  it('rejects a missing appPackage', async () => {
    const result = await createSession(db, userId, { startedAt: '2026-07-12T10:00:00.000Z' });
    expect(result.ok).toBe(false);
  });
});
```

```typescript
// backend/test/handlers/focus/listSessions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { focusSessions } from '../../../src/db/schema';
import { createSession } from '../../../src/handlers/focus/createSession';
import { listSessions } from '../../../src/handlers/focus/listSessions';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-focus-list';
const otherUserId = 'test-user-focus-list-other';

afterEach(async () => {
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
  await db.delete(focusSessions).where(eq(focusSessions.userId, otherUserId));
});

describe('listSessions handler', () => {
  it('returns only the requesting user\'s sessions', async () => {
    await createSession(db, userId, { appPackage: 'com.instagram.android', startedAt: '2026-07-12T10:00:00.000Z' });
    await createSession(db, otherUserId, { appPackage: 'com.reddit.frontpage', startedAt: '2026-07-12T10:00:00.000Z' });

    const rows = await listSessions(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].appPackage).toBe('com.instagram.android');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- test/handlers/focus`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/handlers/focus/createSession.ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { focusSessions } from '../../db/schema';

const CreateSessionSchema = z.object({
  appPackage: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  budgetMinutes: z.number().int().positive().optional(),
});

export type CreateSessionResult =
  | { ok: true; status: 201; body: typeof focusSessions.$inferSelect }
  | { ok: false; status: 400; body: { error: string; code: string } };

export async function createSession(db: Db, userId: string, input: unknown): Promise<CreateSessionResult> {
  const parsed = CreateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: 'Invalid focus session fields', code: 'INVALID_INPUT' } };
  }
  const data = parsed.data;
  const id = randomUUID();
  await db.insert(focusSessions).values({
    id,
    userId,
    appPackage: data.appPackage,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    budgetMinutes: data.budgetMinutes,
  });
  const [row] = await db.select().from(focusSessions).where(eq(focusSessions.id, id)).limit(1);
  return { ok: true, status: 201, body: row };
}
```

```typescript
// backend/src/handlers/focus/listSessions.ts
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { focusSessions } from '../../db/schema';

export async function listSessions(db: Db, userId: string) {
  return db.select().from(focusSessions).where(eq(focusSessions.userId, userId)).orderBy(desc(focusSessions.startedAt));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- test/handlers/focus`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/focus backend/test/handlers/focus
git commit -m "feat(backend): add focus session create/list handlers"
```

---

### Task 16: Focus Vercel route

**Files:**
- Create: `backend/api/focus/index.ts`

**Interfaces:**
- Consumes: handlers from Task 15, `requireAuth`/`ok`/`err` (Task 6).
- Produces: `GET/POST /api/focus`.

- [ ] **Step 1: Write `backend/api/focus/index.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { createSession } from '../../src/handlers/focus/createSession';
import { listSessions } from '../../src/handlers/focus/listSessions';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const rows = await listSessions(db, auth.userId);
    return ok(res, 200, { sessions: rows });
  }

  if (req.method === 'POST') {
    const result = await createSession(db, auth.userId, req.body);
    if (result.ok) return ok(res, result.status, result.body);
    return err(res, result.status, result.body.code, result.body.error);
  }

  return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET or POST');
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -s -X POST "http://localhost:3000/api/focus" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"appPackage":"com.instagram.android","startedAt":"2026-07-12T10:00:00.000Z","budgetMinutes":30}'
curl -s "http://localhost:3000/api/focus" -H "authorization: Bearer $TOKEN"
```
Expected: POST `201`, GET returns `{"sessions":[...]}`.

- [ ] **Step 3: Commit**

```bash
git add backend/api/focus
git commit -m "feat(backend): wire focus Vercel route"
```

---

### Task 17: Dashboard summary handler + route

**Files:**
- Create: `backend/src/handlers/dashboard/summary.ts`
- Create: `backend/api/dashboard/summary.ts`
- Test: `backend/test/handlers/dashboard/summary.test.ts`

**Interfaces:**
- Consumes: `transactions`, `tasks`, `focusSessions` tables (Task 2).
- Produces: `getDashboardSummary(db: Db, userId: string): Promise<{ monthSpend: string; tasksOpen: number; tasksDone: number; focusMinutesToday: number }>`. Consumed by the route adapter.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client';
import { transactions, tasks, focusSessions } from '../../../src/db/schema';
import { createTransaction } from '../../../src/handlers/money/createTransaction';
import { createTask } from '../../../src/handlers/tasks/createTask';
import { createSession } from '../../../src/handlers/focus/createSession';
import { getDashboardSummary } from '../../../src/handlers/dashboard/summary';

const db = getDb(process.env.TEST_DATABASE_URL!);
const userId = 'test-user-dashboard';

afterEach(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(focusSessions).where(eq(focusSessions.userId, userId));
});

describe('getDashboardSummary', () => {
  it('aggregates spend, task counts, and today\'s focus minutes', async () => {
    const now = new Date();
    await createTransaction(db, userId, {
      amount: '100.00', direction: 'debit', source: 'sms', occurredAt: now.toISOString(), dedupRef: 'd1',
    });
    await createTask(db, userId, { title: 'Open task' });
    const done = await createTask(db, userId, { title: 'Done task' });
    if (done.ok) {
      await db.update(tasks).set({ status: 'done' }).where(eq(tasks.id, done.body.id));
    }
    const startedAt = new Date(now.getTime() - 20 * 60_000).toISOString();
    const endedAt = now.toISOString();
    await createSession(db, userId, { appPackage: 'com.instagram.android', startedAt, endedAt });

    const summary = await getDashboardSummary(db, userId);
    expect(summary.monthSpend).toBe('100.00');
    expect(summary.tasksOpen).toBe(1);
    expect(summary.tasksDone).toBe(1);
    expect(summary.focusMinutesToday).toBeGreaterThanOrEqual(19);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- test/handlers/dashboard/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/handlers/dashboard/summary.ts
import { and, eq, gte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { transactions, tasks, focusSessions } from '../../db/schema';

export async function getDashboardSummary(db: Db, userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthTxns = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredAt, monthStart), eq(transactions.direction, 'debit')));
  const monthSpend = monthTxns.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2);

  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const tasksOpen = userTasks.filter((t) => t.status === 'open').length;
  const tasksDone = userTasks.filter((t) => t.status === 'done').length;

  const todaySessions = await db
    .select()
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), gte(focusSessions.startedAt, dayStart)));
  const focusMinutesToday = todaySessions.reduce((sum, s) => {
    if (!s.endedAt) return sum;
    return sum + (s.endedAt.getTime() - s.startedAt.getTime()) / 60_000;
  }, 0);

  return { monthSpend, tasksOpen, tasksDone, focusMinutesToday: Math.round(focusMinutesToday) };
}
```

```typescript
// backend/api/dashboard/summary.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/db/client';
import { getDashboardSummary } from '../../src/handlers/dashboard/summary';
import { ok, err, requireAuth } from '../../src/lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET');
  const auth = requireAuth(req, process.env.JWT_ACCESS_SECRET!);
  if (!auth) return err(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const db = getDb(process.env.DATABASE_URL!);
  const summary = await getDashboardSummary(db, auth.userId);
  return ok(res, 200, summary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- test/handlers/dashboard/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual verification**

```bash
curl -s "http://localhost:3000/api/dashboard/summary" -H "authorization: Bearer $TOKEN"
```
Expected: `200` with `monthSpend`, `tasksOpen`, `tasksDone`, `focusMinutesToday`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/handlers/dashboard backend/api/dashboard backend/test/handlers/dashboard
git commit -m "feat(backend): add dashboard summary handler and route"
```

---

### Task 18: Deploy to Vercel

**Files:** none (infra step).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a live `https://<project>.vercel.app` base URL, needed by Plan B as `EXPO_PUBLIC_API_URL`.

- [ ] **Step 1: Link and deploy**

Run: `cd backend && npx vercel link` (create/select a Vercel project, e.g. `axon-backend`)
Run: `cd backend && npx vercel env add DATABASE_URL production` (paste the **rotated** Neon main connection string — see Global Constraints)
Run: `cd backend && npx vercel env add JWT_ACCESS_SECRET production` (paste the value from `backend/.env`)
Run: `cd backend && npx vercel env add REFRESH_TOKEN_PEPPER production` (paste the value from `backend/.env`)
Run: `cd backend && npx vercel deploy --prod`
Expected: prints a production URL, e.g. `https://axon-backend.vercel.app`.

- [ ] **Step 2: Smoke test production**

```bash
curl -s -X POST https://<project>.vercel.app/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"firstName":"Smoke","lastName":"Test","email":"smoke-test@example.com","phone":"1112223333","password":"correct-horse-battery","confirmPassword":"correct-horse-battery"}'
```
Expected: `201` with a token pair. Delete the smoke-test user afterward via `psql "$DATABASE_URL"`:
```sql
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'smoke-test@example.com');
DELETE FROM users WHERE email = 'smoke-test@example.com';
```

- [ ] **Step 3: Record the production URL**

Note the production URL in `docs/superpowers/specs/2026-07-12-cloud-auth-design.md` §2 or in a follow-up message to the user — Plan B's client work needs it for `EXPO_PUBLIC_API_URL`.

- [ ] **Step 4: Commit**

No code changes in this task; nothing to commit. If `vercel link` created `backend/.vercel/project.json`, leave it out of git (already covered by `backend/.gitignore`).

---

## Self-Review Notes

- **Spec coverage:** §2 architecture → Tasks 1–2, 10–18. §3 signup/login/refresh/logout → Tasks 7–10. §3 schema → Task 2. §5 offline queue is explicitly out of scope for this plan (client-side, belongs to Plan B). §6 error handling (`{error, code}` shape, no leaked internals) → `err()` helper in Task 6, used everywhere. §7 security (DB creds isolated, bcrypt cost 12, JWT secret separate, rate limiting, secure-store on client) → Tasks 1, 3, 4, 5; client-side secure-store is Plan B. §8 backend testing → every handler task includes vitest coverage against a real Neon test branch.
- **Placeholder scan:** none found — every step has runnable code or an exact command with expected output.
- **Type consistency:** `Db` type (Task 2) is the single type threaded through every handler signature; `ok`/`err` (Task 6) used identically in every route adapter; `requireAuth` return shape `{ userId: string }` consistent across Tasks 12, 14, 16, 17.
