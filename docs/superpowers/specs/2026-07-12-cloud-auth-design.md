# Axon — Cloud Backend + Auth Design

Date: 2026-07-12
Status: Approved
Amends: `2026-07-08-axon-design.md` — supersedes its local-only data storage decisions (§2 "Local DB", §3 "No cloud backup" bullet, §9 "Cloud sync/backup" out-of-scope item). All other sections of the original spec (native module architecture, module feature sets, design language) still apply unless noted below.

## 1. Summary

Axon moves from a fully local, offline SQLCipher-backed app to a cloud-backed app with user accounts. All application data (Money transactions, Tasks, Focus sessions) moves to a Postgres database (Neon), accessed through a new thin backend API. The app no longer has a local database — the only client-side persistence is a small pending-writes queue for offline resilience (see §5).

This is a deliberate, explicit reversal of the original spec's "no server, no sync, personal-use local app" decision, made by the user on 2026-07-12.

## 2. Architecture

```
┌──────────────────┐        HTTPS (JWT bearer)        ┌───────────────────────┐
│   Axon (RN app)   │ ───────────────────────────────▶ │  backend/ (Vercel     │
│                    │ ◀─────────────────────────────── │  serverless functions)│
└──────────────────┘                                   └───────────┬───────────┘
                                                                     │ Drizzle ORM
                                                                     │ (Neon HTTP driver)
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │  Neon Postgres          │
                                                          └───────────────────────┘
```

- **Backend:** new `backend/` directory in this repo. Vercel serverless functions, TypeScript. Drizzle ORM with `@neondatabase/serverless` (HTTP driver — no connection pooling needed on serverless).
- **Routes** (all under `/api`):
  - `/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
  - `/api/money/*`, `/api/tasks/*`, `/api/focus/*`, `/api/dashboard/summary`
- **Auth middleware:** every data route verifies the JWT access token, extracts `user_id`, and scopes every query to that user (`WHERE user_id = ?`). No cross-user data access.
- **Client:** `src/db/*` (op-sqlite/SQLCipher) is retired entirely and deleted. Replaced by `src/api/client.ts`, a fetch wrapper that attaches the `Authorization: Bearer` header and reads its base URL from `EXPO_PUBLIC_API_URL`. Each feature gets an `api.ts` (e.g. `src/features/money/api.ts`) replacing the old local-DB write/read calls in `use-transaction-capture.ts`, `use-focus-session-tracking.ts`, `use-voice-capture.ts`, `nagging.ts`.
- **Native modules unchanged.** `SmsReader`, `NotificationListener`, `OverlayService`, `UsageTracker` keep parsing in native memory and never persist raw SMS/notification text — that structural guarantee from the original spec's §3 is untouched. The only change is where the *parsed, structured* result goes: previously a local SQLite insert, now a POST to the backend (via the pending-writes queue on failure — §5).

## 3. Data model (Postgres, Drizzle schema)

```
users:           id, first_name, last_name, email (unique), phone (unique),
                 password_hash, created_at
sessions:        id, user_id, refresh_token_hash, expires_at, created_at
transactions:    id, user_id, amount, direction, merchant, category, source (sms|notif),
                 occurred_at, dedup_ref, created_at
tasks:           id, user_id, title, parent_task_id (nullable, for subtasks),
                 status, nag_schedule, created_at
focus_sessions:  id, user_id, app_package, started_at, ended_at, budget_minutes, created_at
```

Indexes: `users(email)`, `users(phone)`, `transactions(user_id, occurred_at)`, `transactions(dedup_ref)` (preserves the existing SMS/notification dedup logic from the original spec's Money module), `tasks(user_id, status)`.

Migrations are managed with `drizzle-kit`, run against the Neon connection string supplied by the user (stored only in Vercel env vars — see §6).

## 4. Auth flow

- **Signup** — `POST /api/auth/signup` `{first_name, last_name, email, phone, password, confirm_password}`. Server validates `password === confirm_password`, checks email/phone uniqueness, enforces a minimum password length (8 chars), hashes with bcrypt (cost factor 12), inserts the user, issues a token pair.
- **Login** — `POST /api/auth/login` `{email, password}`. Email is the v1 login identifier (not phone). bcrypt compare against `password_hash`, issue a new token pair on success.
- **Tokens** — access token (JWT, 15 min expiry) + refresh token (30 day expiry, stored server-side as a hash in `sessions` for revocation). Both returned to the client on signup/login.
- **Refresh** — `POST /api/auth/refresh` `{refresh_token}`. Validates against `sessions`, rotates the refresh token (old one invalidated), issues a new access token.
- **Client storage** — both tokens held in `expo-secure-store` (Keystore-backed on Android, consistent with the original spec's security posture). Every API call attaches `Authorization: Bearer <access_token>`. On a 401, the client refreshes once and retries; if refresh also fails, tokens are cleared and the user is routed to the login screen.
- **Logout** — clears local tokens and calls `/api/auth/logout`, which deletes the corresponding `sessions` row to revoke the refresh token server-side.

## 5. Offline write resilience

SMS/UPI notifications can arrive with no mobile data connectivity (carrier SMS delivery doesn't require it). Because there is no local database, a failed POST would otherwise silently lose that transaction.

- A small pending-writes queue — a JSON array under one `expo-secure-store` key (`pending_writes`), entries shaped `{endpoint, payload, timestamp}` — holds any write (transaction, task, focus session) whose POST failed.
- Flushed on app foreground and on network-reconnect (via `NetInfo`/`expo-network`), oldest first, removed from the queue on successful POST.
- This is a write-behind delivery buffer, not a general-purpose local database — it holds nothing once successfully synced, and reads are never served from it.

## 6. Error handling

- **Backend** returns a consistent `{error: string, code: string}` JSON body on all 4xx/5xx responses. Stack traces and raw SQL errors are never sent to the client.
- **Client writes:** a network failure enqueues to the pending-writes queue (§5) rather than surfacing as a hard error, unless the queue write itself fails.
- **Client reads:** a network failure on a read shows the last successful in-memory/secure-store-cached result with an "offline — showing last synced data" banner. This is a short-lived cache of the last response, not a local database.
- **Signup conflicts:** duplicate email or phone returns 409 with a field-specific message, shown inline on the form next to the offending field.

## 7. Security

- `DATABASE_URL` (the Neon connection string) lives only in Vercel environment variables — never in the RN app bundle, never committed to the repo. **The connection string shared in chat during this design session must be rotated in the Neon console before this ships.**
- Passwords hashed with bcrypt, cost factor 12; raw passwords are never logged.
- JWT signing secret is a separate Vercel env var from the DB credential, rotated independently.
- `/api/auth/*` routes are rate-limited (IP + email) to blunt credential-stuffing attempts.
- Tokens on-device use `expo-secure-store`, matching the hardware-backed storage approach the original spec used for the SQLCipher key.

## 8. Testing

- **Backend:** unit tests per route handler (signup validation incl. password-mismatch/duplicate-email cases, login, refresh-token rotation) run against a Neon test branch or local Postgres via Drizzle.
- **Client:** manual end-to-end verification — signup → login → app unlocks → SMS-triggered transaction POST succeeds → kill network → transaction enters pending-writes queue → restore network → queue flushes and transaction appears.

## 9. Out of scope (this change)

- Phone-based login (email is the only v1 login identifier; phone is still collected and stored).
- Password reset / forgot-password flow.
- Social login (Google/Apple).
- Multi-device conflict resolution beyond "last write wins" implicit in a single source of truth (Postgres) — not applicable here since there's no longer a local copy to conflict with.
